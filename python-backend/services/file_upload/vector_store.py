"""
Vector store module - ChromaDB-based document storage and retrieval.
"""
import torch
import chromadb
from typing import List, Tuple, Optional, Dict, Any
import hashlib
import shutil
import os
from config import CHROMA_DB_PATH, CHROMA_COLLECTION, TOP_K_RESULTS
from utils.embeddings import ChromaEmbeddingAdapter
from utils.logging import vector_store_logger

log = vector_store_logger()


# Singleton ChromaDB client
_client: Optional[chromadb.PersistentClient] = None
_collection = None


def get_collection():
    """Get or create the ChromaDB collection."""
    global _client, _collection
    if _collection is None:
        os.makedirs(CHROMA_DB_PATH, exist_ok=True)
        _client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
        _collection = _client.get_or_create_collection(
            name=CHROMA_COLLECTION,
            embedding_function=ChromaEmbeddingAdapter()
        )
    return _collection


def _reset_database():
    """Reset database references."""
    global _client, _collection
    _collection = None
    _client = None


def _try_delete_folder() -> bool:
    """Try to delete the database folder. Returns True if successful."""
    if os.path.exists(CHROMA_DB_PATH):
        shutil.rmtree(CHROMA_DB_PATH)
        log.info(f"Cleared database folder at {CHROMA_DB_PATH}")
    return True


def _try_recreate_collection() -> bool:
    """Fallback: delete and recreate collection if folder is locked."""
    global _client, _collection
    
    _client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
    
    try:
        _client.delete_collection(name=CHROMA_COLLECTION)
        log.info(f"Deleted collection '{CHROMA_COLLECTION}'")
    except Exception:
        pass  # Collection might not exist
    
    _collection = _client.get_or_create_collection(
        name=CHROMA_COLLECTION,
        embedding_function=ChromaEmbeddingAdapter()
    )
    log.info(f"Recreated empty collection '{CHROMA_COLLECTION}'")
    return True


def clear_database() -> bool:
    """
    Clear the entire ChromaDB database.
    First tries to delete the folder, if that fails (file locked), 
    falls back to deleting and recreating the collection.
    
    Returns:
        True if cleared successfully, False otherwise
    """
    _reset_database()
    
    try:
        return _try_delete_folder()
    except (PermissionError, OSError) as e:
        log.warning(f"Folder deletion failed: {e}")
        try:
            return _try_recreate_collection()
        except Exception as e2:
            log.error(f"Collection recreation failed: {e2}")
            return False
    except Exception as e:
        log.error(f"Error clearing database: {e}")
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
    n_results: int = TOP_K_RESULTS,
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


def cleanup_orphaned_files(current_filenames: List[str]) -> int:
    """
    Delete files from ChromaDB that are not in the current list.
    
    Args:
        current_filenames: List of filenames that should be kept
        
    Returns:
        Number of orphaned files deleted
    """
    db_filenames = get_all_filenames()
    orphaned = [f for f in db_filenames if f not in current_filenames]
    
    if orphaned:
        log.info(f"Found {len(orphaned)} orphaned file(s)")
        for filename in orphaned:
            log.debug(f"Deleting: {filename}")
        delete_documents(orphaned)
        log.info("Cleanup complete")
    
    return len(orphaned)

