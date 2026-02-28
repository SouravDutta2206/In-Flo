"""
Context Builder Service - Orchestrates RAG context building from multiple sources.
Extracts web search and file context, merges source maps, and prepares final prompt.
"""
from typing import List, Optional, Tuple
import time

from utils.schemas import Message, ModelInfo, FileContext
from utils.sources import process_search_results
from utils.logging import context_builder_logger
from services.web_search.search import search_and_scrape as search
from services.web_search.faiss import chunk_docs, faiss_search
from services.web_search.query_expander import expand_search_query
from services.file_upload.vector_store import query_documents, cleanup_orphaned_files

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


def merge_contexts(
    web_context: str,
    web_source_map: Optional[dict],
    files_context: str,
    files_source_map: Optional[dict]
) -> Tuple[str, dict]:
    """
    Merge web and file contexts into a single context string and source map.
    
    Args:
        web_context: Context string from web search
        web_source_map: Source map from web search
        files_context: Context string from file RAG
        files_source_map: Source map from file RAG
        
    Returns:
        Tuple of (combined_context, merged_source_map)
    """
    # Merge source maps (offset file sources if web sources exist)
    source_map = {}
    if web_source_map:
        source_map.update(web_source_map)
    if files_source_map:
        offset = len(source_map)
        for key, value in files_source_map.items():
            source_map[key + offset] = value
    
    # Combine contexts
    context_parts = []
    if web_context:
        context_parts.append(f"Web Search Results:\n{web_context}")
    if files_context:
        context_parts.append(f"Document Context:\n{files_context}")
    
    return "\n\n".join(context_parts), source_map


async def build_full_context(
    query: str,
    history: List[Message],
    model: ModelInfo,
    files: Optional[List[FileContext]],
    web_search: bool,
    tavily_api_key: str
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
    
    # Merge everything
    return merge_contexts(
        web_context, web_source_map,
        files_context, files_source_map
    )
