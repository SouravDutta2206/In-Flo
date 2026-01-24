"""
Vector store module - ChromaDB-based document storage and retrieval.
Uses the same SentenceTransformer model as faiss.py for consistency.
"""
import sys
sys.dont_write_bytecode = True

import chromadb
from chromadb import Documents, EmbeddingFunction, Embeddings
from sentence_transformers import SentenceTransformer
from typing import List, Tuple, Optional, Dict, Any
import hashlib
import shutil
import os

# Configuration - same model as faiss.py
MODEL_NAME = "all-MiniLM-L6-v2"
COLLECTION_NAME = "documents"
DB_PATH = "./chroma_db/file_upload"
TOP_K = 5

# Singleton model instance
_model: Optional[SentenceTransformer] = None


def get_model() -> SentenceTransformer:
    """Get or create the shared embedding model."""
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
    return _model


class LocalEmbeddingFunction(EmbeddingFunction):
    """Custom embedding function using local SentenceTransformer."""
    
    def __call__(self, input: Documents) -> Embeddings:
        model = get_model()
        embeddings = model.encode(input, convert_to_numpy=True, device="cuda" if torch.cuda.is_available() else "cpu")
        return embeddings.tolist()


# Singleton ChromaDB client
_client: Optional[chromadb.PersistentClient] = None
_collection = None


def get_collection():
    """Get or create the ChromaDB collection."""
    global _client, _collection
    if _collection is None:
        # Ensure the directory exists
        os.makedirs(DB_PATH, exist_ok=True)
        _client = chromadb.PersistentClient(path=DB_PATH)
        _collection = _client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=LocalEmbeddingFunction()
        )
    return _collection


def clear_database() -> bool:
    """
    Clear the entire ChromaDB database.
    First tries to delete the folder, if that fails (file locked), deletes the collection instead.
    
    Returns:
        True if cleared successfully, False otherwise
    """
    global _client, _collection
    
    # First, try to delete the folder (cleanest approach)
    try:
        # Reset singleton references first
        _collection = None
        _client = None
        
        if os.path.exists(DB_PATH):
            shutil.rmtree(DB_PATH)
            print(f"[VECTOR_STORE] Cleared database folder at {DB_PATH}")
            return True
        return True  # Folder doesn't exist, nothing to clear
        
    except (PermissionError, OSError) as e:
        print(f"[VECTOR_STORE] Folder deletion failed (in use), falling back to collection deletion: {e}")
        
        # Fallback: Delete and recreate collection if folder is locked
        try:
            # Re-initialize client since we cleared it
            _client = chromadb.PersistentClient(path=DB_PATH)
            
            try:
                _client.delete_collection(name=COLLECTION_NAME)
                print(f"[VECTOR_STORE] Deleted collection '{COLLECTION_NAME}'")
            except Exception:
                pass  # Collection might not exist
            
            # Recreate empty collection
            _collection = _client.get_or_create_collection(
                name=COLLECTION_NAME,
                embedding_function=LocalEmbeddingFunction()
            )
            print(f"[VECTOR_STORE] Recreated empty collection '{COLLECTION_NAME}'")
            return True
            
        except Exception as e2:
            print(f"[VECTOR_STORE] Error in fallback collection deletion: {e2}")
            return False
    
    except Exception as e:
        print(f"[VECTOR_STORE] Error clearing database: {e}")
        return False


def generate_chunk_id(filename: str, page: int, chunk_index: int) -> str:
    """Generate a unique ID for a chunk."""
    content = f"{filename}:{page}:{chunk_index}"
    return hashlib.md5(content.encode()).hexdigest()


def add_documents(
    chunks: List[str],
    metadatas: List[Dict[str, Any]],
    filename: str
) -> int:
    """
    Add document chunks to ChromaDB.
    
    Args:
        chunks: List of text chunks
        metadatas: List of metadata dicts with 'filename' and 'page' keys
        filename: Source filename for ID generation
        
    Returns:
        Number of chunks added
    """
    if not chunks:
        return 0
    
    collection = get_collection()
    
    # Generate unique IDs
    ids = [
        generate_chunk_id(filename, meta.get("page", 0), i)
        for i, meta in enumerate(metadatas)
    ]
    
    # Add to collection
    collection.add(
        documents=chunks,
        metadatas=metadatas,
        ids=ids
    )
    
    return len(chunks)


def query_documents(
    query: str,
    n_results: int = TOP_K,
    filenames: Optional[List[str]] = None
) -> List[Tuple[str, float, str]]:
    """
    Query ChromaDB for relevant chunks.
    
    Args:
        query: Search query
        n_results: Number of results to return
        filenames: Optional list of filenames to filter by
        
    Returns:
        List of (content, score, "filename#page=N") tuples
        Compatible with process_search_results from sources.py
    """
    collection = get_collection()
    
    # Build filter if filenames provided
    where_filter = None
    if filenames:
        if len(filenames) == 1:
            where_filter = {"filename": filenames[0]}
        else:
            where_filter = {"filename": {"$in": filenames}}
    
    # Query
    results = collection.query(
        query_texts=[query],
        n_results=n_results,
        where=where_filter,
        include=["documents", "metadatas", "distances"]
    )
    
    # Format results for sources.py compatibility
    formatted = []
    if results["documents"] and results["documents"][0]:
        docs = results["documents"][0]
        metas = results["metadatas"][0] if results["metadatas"] else [{}] * len(docs)
        distances = results["distances"][0] if results["distances"] else [0.0] * len(docs)
        
        for doc, meta, dist in zip(docs, metas, distances):
            filename = meta.get("filename", "unknown")
            page = meta.get("page", 1)
            source = f"{filename}#page={page}"
            # Convert distance to similarity score (ChromaDB uses L2 distance)
            score = 1.0 / (1.0 + dist)
            formatted.append((doc, score, source))
    
    return formatted


def delete_documents(filenames: List[str]) -> int:
    """
    Delete all chunks for given filenames.
    
    Args:
        filenames: List of filenames to delete
        
    Returns:
        Number deleted (approximate, ChromaDB doesn't return exact count)
    """
    if not filenames:
        return 0
    
    collection = get_collection()
    
    for filename in filenames:
        collection.delete(where={"filename": filename})
    
    return len(filenames)


def get_document_count(filename: Optional[str] = None) -> int:
    """Get count of documents in collection, optionally filtered by filename."""
    collection = get_collection()
    
    if filename:
        results = collection.get(where={"filename": filename})
        return len(results["ids"]) if results["ids"] else 0
    
    return collection.count()


def get_all_filenames() -> List[str]:
    """
    Get list of all unique filenames in the collection.
    
    Returns:
        List of unique filenames stored in ChromaDB
    """
    collection = get_collection()
    
    # Get all documents (just metadata, not embeddings)
    results = collection.get(include=["metadatas"])
    
    if not results["metadatas"]:
        return []
    
    # Extract unique filenames
    filenames = set()
    for metadata in results["metadatas"]:
        if "filename" in metadata:
            filenames.add(metadata["filename"])
    
    return list(filenames)

