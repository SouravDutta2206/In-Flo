"""
Context Builder Service - Orchestrates RAG context building from multiple sources.
Extracts web search and file context, merges source maps, and prepares final prompt.
"""
from typing import List, Optional, Tuple
import time

from utils.schemas import Message, ModelInfo, FileContext, SelectedDocumentBank
from utils.sources import process_search_results
from utils.logging import context_builder_logger
from services.web_search.search import search_and_scrape as search
from services.web_search.faiss import chunk_docs, faiss_search
from services.web_search.query_expander import expand_search_query
from services.file_upload.vector_store import query_documents, cleanup_orphaned_files
from services.document_banks.vector_store import query_bank_documents

log = context_builder_logger()


async def build_web_context(
    query: str,
    history: List[Message],
    model: ModelInfo,
    tavily_api_key: str
) -> Tuple[str, Optional[dict]]:
    """
    Build context from web search with query expansion.
    
    Args:
        query: User's current query
        history: Conversation history for query expansion
        model: Model info for LLM-based query expansion
        tavily_api_key: API key for Tavily search
        
    Returns:
        Tuple of (context_string, source_map) or ("", None) if no results
    """
    # Expand query using conversation context
    expanded_query = await expand_search_query(
        query=query,
        conversation_history=history,
        model=model
    )
    log.info(f"Original: '{query[:80]}...' -> Expanded: '{expanded_query}'")
    
    # Perform web search
    start_time = time.time()
    results = await search(query=expanded_query, tavily_api_key=tavily_api_key)
    if not results:
        return "", None
    
    chunks = chunk_docs(docs=results)
    search_results = faiss_search(chunks=chunks, user_query=expanded_query)
    log.info(f"Web search took {time.time() - start_time:.2f}s")
    
    return search_results


def build_file_context(
    query: str,
    files: Optional[List[FileContext]]
) -> Tuple[str, Optional[dict]]:
    """
    Build context from uploaded files via ChromaDB RAG.
    Also cleans up orphaned files from the database.
    
    Args:
        query: User's current query
        files: List of file contexts from the request
        
    Returns:
        Tuple of (context_string, source_map) or ("", None) if no files
    """
    # # Clean up orphaned files in ChromaDB
    # current_filenames = [f.name for f in files] if files else []
    # cleanup_orphaned_files(current_filenames)
    
    # Query files if provided
    if not files:
        return "", None
    
    filenames = [f.name for f in files]
    file_results = query_documents(
        query=query,
        n_results=5,
        filenames=filenames
    )
    
    if not file_results:
        return "", None
    
    return process_search_results(file_results)


def build_bank_context(
    query: str,
    document_banks: Optional[List[SelectedDocumentBank]]
) -> Tuple[str, Optional[dict]]:
    """
    Build context from selected persistent document banks.
    
    Args:
        query: User's current query
        document_banks: List of selected document banks
        
    Returns:
        Tuple of (context_string, source_map) or ("", None) if no banks selected
    """
    if not document_banks:
        return "", None
    
    bank_ids = [b.id for b in document_banks]
    bank_results = query_bank_documents(query=query, bank_ids=bank_ids)
    
    if not bank_results:
        return "", None
    
    log.info(f"Bank context: {len(bank_results)} results from {len(bank_ids)} bank(s)")
    return process_search_results(bank_results)


def merge_contexts(
    web_context: str,
    web_source_map: Optional[dict],
    files_context: str,
    files_source_map: Optional[dict],
    bank_context: str = "",
    bank_source_map: Optional[dict] = None,
) -> Tuple[str, dict]:
    """
    Merge web, file, and document bank contexts into a single context string and source map.
    
    Args:
        web_context: Context string from web search
        web_source_map: Source map from web search
        files_context: Context string from file RAG
        files_source_map: Source map from file RAG
        bank_context: Context string from document banks
        bank_source_map: Source map from document banks
        
    Returns:
        Tuple of (combined_context, merged_source_map)
    """
    # Merge source maps (offset to avoid ID collisions)
    source_map = {}
    if web_source_map:
        source_map.update(web_source_map)
    if files_source_map:
        offset = len(source_map)
        for key, value in files_source_map.items():
            source_map[key + offset] = value
    if bank_source_map:
        offset = len(source_map)
        for key, value in bank_source_map.items():
            source_map[key + offset] = value
    
    # Combine contexts
    context_parts = []
    if web_context:
        context_parts.append(f"Web Search Results:\n{web_context}")
    if files_context:
        context_parts.append(f"Document Context:\n{files_context}")
    if bank_context:
        context_parts.append(f"Document Bank Context:\n{bank_context}")
    
    return "\n\n".join(context_parts), source_map


async def build_full_context(
    query: str,
    history: List[Message],
    model: ModelInfo,
    files: Optional[List[FileContext]],
    web_search: bool,
    tavily_api_key: str,
    document_banks: Optional[List[SelectedDocumentBank]] = None,
) -> Tuple[str, dict]:
    """
    Build complete RAG context from all sources.
    
    Args:
        query: User's current query
        history: Conversation history
        model: Model info for query expansion
        files: Optional list of file contexts
        web_search: Whether to perform web search
        tavily_api_key: API key for Tavily
        document_banks: Optional list of selected document banks
        
    Returns:
        Tuple of (combined_context, merged_source_map)
    """
    # Web search context
    web_context, web_source_map = "", None
    if web_search:
        web_context, web_source_map = await build_web_context(
            query, history, model, tavily_api_key
        )
    
    # File context
    files_context, files_source_map = build_file_context(query, files)
    
    # Document bank context
    bank_context, bank_source_map = build_bank_context(query, document_banks)
    
    # Merge everything
    return merge_contexts(
        web_context, web_source_map,
        files_context, files_source_map,
        bank_context, bank_source_map,
    )
