"""
Persistent Document Bank Vector Store - ChromaDB-based storage for document bank chunks.
Uses a separate Chroma path from the temporary file upload store.
Never cleared on startup.
"""
import os
import hashlib
import chromadb
from typing import List, Tuple, Optional

from config import DOCUMENT_BANK_DB_PATH, DOCUMENT_BANK_COLLECTION_PREFIX, TOP_K_RESULTS
from utils.embeddings import ChromaEmbeddingAdapter
from utils.logging import get_logger

log = get_logger("BANK_VECTOR")

# Singleton ChromaDB client for document banks (separate from temp uploads)
_client: Optional[chromadb.PersistentClient] = None


def _get_client() -> chromadb.PersistentClient:
    """Get or create the persistent ChromaDB client for document banks."""
    global _client
    if _client is None:
        os.makedirs(DOCUMENT_BANK_DB_PATH, exist_ok=True)
        _client = chromadb.PersistentClient(path=DOCUMENT_BANK_DB_PATH)
    return _client


def get_bank_collection(bank_id: str):
    """Get or create the Chroma collection for a specific bank."""
    client = _get_client()
    collection_name = f"{DOCUMENT_BANK_COLLECTION_PREFIX}{bank_id.replace('-', '_')}"
    # Chroma collection names: max 63 chars, alphanumeric + underscores
    collection_name = collection_name[:63]
    return client.get_or_create_collection(
        name=collection_name,
        embedding_function=ChromaEmbeddingAdapter()
    )


def _generate_chunk_id(bank_id: str, filename: str, page: int, chunk_index: int) -> str:
    """Generate a unique ID for a bank chunk."""
    content = f"bank:{bank_id}:{filename}:{page}:{chunk_index}"
    return hashlib.md5(content.encode()).hexdigest()


def add_bank_documents(
    bank_id: str,
    bank_name: str,
    filename: str,
    chunks: List[str],
    metadatas: List[dict],
) -> int:
    """
    Add document chunks to a bank's Chroma collection.

    Args:
        bank_id: Bank UUID
        bank_name: Human-readable bank name (stored in metadata)
        filename: Source filename
        chunks: List of text chunks
        metadatas: List of metadata dicts from PDF processing

    Returns:
        Number of chunks added
    """
    if not chunks:
        return 0

    collection = get_bank_collection(bank_id)

    # Enrich metadata and generate IDs
    ids = []
    enriched_metas = []
    for i, meta in enumerate(metadatas):
        ids.append(_generate_chunk_id(bank_id, filename, meta.get("page", 0), i))
        enriched_metas.append({
            "bank_id": bank_id,
            "bank_name": bank_name,
            "filename": filename,
            "page": meta.get("page", 1),
            "chunk_index": i,
            "uploaded_at": meta.get("uploaded_at", ""),
        })

    collection.add(
        documents=chunks,
        metadatas=enriched_metas,
        ids=ids,
    )

    log.info(f"Added {len(chunks)} chunks for '{filename}' to bank {bank_id}")
    return len(chunks)


def query_bank_documents(
    query: str,
    bank_ids: List[str],
    n_results: int = TOP_K_RESULTS,
) -> List[Tuple[str, float, str]]:
    """
    Query multiple bank collections and return combined results sorted by similarity.

    Args:
        query: Search query
        bank_ids: List of bank IDs to search
        n_results: Max results per bank

    Returns:
        List of (content, score, source_identifier) tuples
        Source format: bank://{bank_name}/{filename}#page={page}
    """
    all_results = []

    for bank_id in bank_ids:
        try:
            collection = get_bank_collection(bank_id)
            if collection.count() == 0:
                continue

            results = collection.query(
                query_texts=[query],
                n_results=min(n_results, collection.count()),
                include=["documents", "metadatas", "distances"],
            )

            if results["documents"] and results["documents"][0]:
                docs = results["documents"][0]
                metas = results["metadatas"][0] if results["metadatas"] else [{}] * len(docs)
                distances = results["distances"][0] if results["distances"] else [0.0] * len(docs)

                for doc, meta, dist in zip(docs, metas, distances):
                    bank_name = meta.get("bank_name", "Unknown")
                    filename = meta.get("filename", "unknown")
                    page = meta.get("page", 1)
                    source = f"bank://{bank_name}/{filename}#page={page}"
                    score = 1.0 / (1.0 + dist)
                    all_results.append((doc, score, source))
        except Exception as e:
            log.warning(f"Error querying bank {bank_id}: {e}")

    # Sort by score descending and limit to top n_results
    all_results.sort(key=lambda x: x[1], reverse=True)
    return all_results[:n_results]


def delete_bank_file(bank_id: str, filename: str) -> int:
    """Delete all chunks for a file from a bank collection."""
    try:
        collection = get_bank_collection(bank_id)
        collection.delete(where={"filename": filename})
        log.info(f"Deleted chunks for '{filename}' from bank {bank_id}")
        return 1
    except Exception as e:
        log.warning(f"Error deleting file from bank: {e}")
        return 0


def delete_bank(bank_id: str) -> bool:
    """Delete an entire bank's Chroma collection."""
    try:
        client = _get_client()
        collection_name = f"{DOCUMENT_BANK_COLLECTION_PREFIX}{bank_id.replace('-', '_')}"
        collection_name = collection_name[:63]
        try:
            client.delete_collection(name=collection_name)
            log.info(f"Deleted collection for bank {bank_id}")
        except Exception:
            pass  # Collection may not exist yet
        return True
    except Exception as e:
        log.error(f"Error deleting bank collection: {e}")
        return False
