"""
Chat routes - handles the main chat endpoint with streaming support.
"""
import sys
sys.dont_write_bytecode = True

import re
import time
from typing import List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks

from utils.prompts import PROMPT_WITH_CONTEXT, BASE_PROMPT
from utils.schemas import ChatRequest, Message, RequestState
from providers import chat_stream
from services.web_search.search import search_and_scrape as search
from services.web_search.faiss import chunk_docs, faiss_search
from services.file_upload.vector_store import query_documents, delete_documents, get_all_filenames
from utils.sources import process_search_results

router = APIRouter(tags=["chat"])


def filter_conversation(conversation: List[Message]) -> List[Message]:
    """Filter out empty or invalid messages from the conversation."""
    def is_valid(content: str) -> bool:
        return bool(content and content.strip() and content.lower() != "undefined")
    
    return [msg for msg in conversation if is_valid(msg.content)]


async def process_web_search(
    query: str, 
    tavily_api_key: str
) -> tuple[str, Optional[dict]]:
    """
    Perform web search and return context + source map.
    
    Returns:
        Tuple of (context_string, source_map) or ("", None) if no results
    """
    start_time = time.time()
    results = await search(query=query, tavily_api_key=tavily_api_key)
    if not results:
        return "", None
    
    chunks = chunk_docs(docs=results)
    search_results = faiss_search(chunks=chunks, user_query=query)
    end_time = time.time()
    print(f"[WEB SEARCH] took {end_time - start_time:.2f}s")
    return search_results


def build_prompt(query: str, context: str, source_map: Optional[dict]) -> Message:
    """Build the formatted prompt message with or without context."""
    if context:
        content = PROMPT_WITH_CONTEXT.format(
            context=context,
            query=query,
            source_map=source_map or {}
        )
    else:
        content = f"{query}{BASE_PROMPT}"
    
    content = re.sub(r"[^\S\n]+", " ", content)
    
    return Message(role="user", content=content)



@router.post("/api/chat")
async def chat(request: ChatRequest, background_tasks: BackgroundTasks):
    """Handle chat request with streaming response."""
    from server import app  # Import here to avoid circular import
    
    # Track request
    request_id = id(request)
    if not hasattr(app.state, 'active_requests'):
        app.state.active_requests = set()
    app.state.active_requests.add(request_id)
    
    # Schedule cleanup
    async def cleanup():
        if hasattr(app.state, 'active_requests'):
            app.state.active_requests.discard(request_id)
    background_tasks.add_task(cleanup)

    # Prepare conversation
    request.conversation = filter_conversation(request.conversation)
    
    print(f"Provider: {request.model.provider}")
    print(f"Model: {request.model.name}")
    print(f"Web Search: {request.web_search}")
    print(f"Files: {str(request.files)[:100]}...")

    # Extract history and current message
    history = request.conversation[:-1]
    current_message = request.conversation[-1]
    
    # Process web search if enabled
    web_context, web_source_map = "", None
    if request.web_search:
        # Expand query using conversation context
        from services.web_search.query_expander import expand_search_query
        expanded_query = await expand_search_query(
            query=current_message.content,
            conversation_history=history,
            model=request.model
        )
        print(f"[QUERY EXPANSION] Original: '{current_message.content[:80]}...'")
        print(f"[QUERY EXPANSION] Expanded: '{expanded_query}'")
        
        web_context, web_source_map = await process_web_search(
            expanded_query, 
            request.tavily_api_key
        )

    # Clean up orphaned files in ChromaDB (files deleted from frontend)
    current_filenames = [f.name for f in request.files] if request.files else []
    db_filenames = get_all_filenames()
    orphaned = [f for f in db_filenames if f not in current_filenames]
    
    if orphaned:
        print(f"[CLEANUP] Found {len(orphaned)} orphaned file(s) in ChromaDB")
        for filename in orphaned:
            print(f"[CLEANUP] Deleting: {filename}")
        delete_documents(orphaned)
        print(f"[CLEANUP] Cleanup complete")

    # Process file context via ChromaDB RAG if files provided
    files_context, files_source_map = "", None
    if request.files:
        filenames = [f.name for f in request.files]
        file_results = query_documents(
            query=current_message.content,
            n_results=5,
            filenames=filenames
        )
        if file_results:
            files_context, files_source_map = process_search_results(file_results)

    # Merge source maps (offset file sources if web sources exist)
    source_map = {}
    if web_source_map:
        source_map.update(web_source_map)
    if files_source_map:
        offset = len(source_map)
        for key, value in files_source_map.items():
            source_map[key + offset] = value

    # Combine contexts (only include non-empty parts)
    context_parts = []
    if web_context:
        context_parts.append(f"Web Search Results:\n{web_context}")
    if files_context:
        context_parts.append(f"Document Context:\n{files_context}")
    context = "\n\n".join(context_parts)

    # Build final prompt
    formatted_message = build_prompt(current_message.content, context, source_map)
    request.conversation = history + [formatted_message]

    # Create request state and dispatch to provider
    state = RequestState(request_id, app)
    
    try:
        return await chat_stream(request, state, source_map)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
