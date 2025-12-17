"""
FAISS module - handles document chunking, embedding, and similarity search.
"""
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from langchain_classic.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from utils.sources import process_search_results

# Configuration
MODEL_NAME = "all-MiniLM-L6-v2"
TOP_K = 5
CHUNK_SIZE = 800
CHUNK_OVERLAP = 80


def chunk_docs(docs: list[Document]) -> list[Document]:
    """Split documents into smaller chunks for embedding."""
    if not docs:
        return []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        length_function=len,
        separators=["\n\n", "\n", ".", "?", "!", " ", ""]
    )
    return splitter.split_documents(docs)


def build_index(chunks: list[Document], model: SentenceTransformer) -> faiss.Index:
    """Build a FAISS HNSW index from document chunks."""
    texts = [doc.page_content for doc in chunks]
    embeddings = model.encode(
        texts, 
        batch_size=64, 
        convert_to_numpy=True, 
        show_progress_bar=False
    ).astype(np.float32)
    
    dim = embeddings.shape[1]
    index = faiss.IndexHNSWFlat(dim, 32)
    index.hnsw.efConstruction = 100
    index.hnsw.efSearch = 64
    index.add(embeddings)
    
    return index


def search(
    query: str, 
    model: SentenceTransformer, 
    index: faiss.Index, 
    chunks: list[Document], 
    top_k: int = TOP_K
) -> list[tuple[str, float, str]]:
    """
    Search for similar chunks using FAISS.
    
    Returns:
        List of (chunk_content, score, source_url) tuples
    """
    query_embedding = model.encode([query], convert_to_numpy=True).astype(np.float32)
    distances, indices = index.search(query_embedding, top_k)
    
    return [
        (
            chunks[i].page_content,
            float(distances[0][idx]),
            chunks[i].metadata.get('source', 'Unknown')
        )
        for idx, i in enumerate(indices[0])
    ]


def faiss_search(
    chunks: list[Document], 
    user_query: str,
    top_k: int = TOP_K
) -> tuple[str, dict[int, dict[str, any]]]:
    """
    Perform FAISS similarity search and return context + source map.
    
    Args:
        chunks: List of document chunks to search
        user_query: User's search query
        top_k: Number of top results to return
        
    Returns:
        Tuple of (context_string, source_map)
    """
    model = SentenceTransformer(MODEL_NAME)
    index = build_index(chunks, model)
    results = search(user_query, model, index, chunks, top_k)
    
    # Clean up
    del index
    
    return process_search_results(results)
