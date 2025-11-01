import faiss
import numpy as np

from sentence_transformers import SentenceTransformer

from langchain_classic.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

def chunk_docs(docs: list[Document]) -> list[str]:

    if not docs:
        return []

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=80,
        length_function=len,
        separators=["\n\n", "\n", ".", "?", "!", " ", ""]
    )
    split_docs = text_splitter.split_documents(docs)

    texts = [doc.page_content for doc in split_docs]

    return texts



MODEL_NAME = "all-MiniLM-L6-v2"
TOP_K = 5

def build_index(chunks: list[str], model: SentenceTransformer) -> tuple[any, np.ndarray]:
    #print(f"Embedding {len(chunks)} chunks...")
    embeddings = model.encode(chunks, batch_size=64, convert_to_numpy=True, show_progress_bar=False).astype(np.float32)
    
    dim = embeddings.shape[1]
    index = faiss.IndexHNSWFlat(dim, 32)
    index.hnsw.efConstruction = 100
    index.add(embeddings)
    index.hnsw.efSearch = 64
    return index, embeddings


def search(user_query: str, model: SentenceTransformer, index: any, chunks: list[str], top_k: int = 5) -> list[tuple[str, float]]:
    q_emb = model.encode([user_query], convert_to_numpy=True).astype(np.float32)
    D, I = index.search(q_emb, top_k)
    results = [(chunks[i], float(D[0][idx])) for idx, i in enumerate(I[0])]
    return results


def faiss_search(chunks: list[str], user_query: str) -> str:
    
    model = SentenceTransformer(MODEL_NAME)
    index, _ = build_index(chunks=chunks, model=model)
    results = search(user_query=user_query, model=model, index=index, chunks=chunks, top_k=TOP_K)
    del index, chunks

    all_chunks = "\n".join(chunk for chunk, score in results)

    if all_chunks:
        print("Web Search Result Length:", len(all_chunks))
    else:
        print("No results found from Web search.")
        
    return all_chunks