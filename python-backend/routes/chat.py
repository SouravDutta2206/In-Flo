"""
Chat routes - handles the main chat endpoint with streaming support.
"""
import re
from typing import List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks

from utils.prompts import PROMPT_WITH_CONTEXT, BASE_PROMPT
from utils.schemas import ChatRequest, Message, RequestState
from utils.logging import chat_logger
from providers import chat_stream
from services.chat.context_builder import build_full_context
from services.file_upload.vector_store import cleanup_orphaned_files

log = chat_logger()
router = APIRouter(tags=["chat"])


def filter_conversation(conversation: List[Message]) -> List[Message]:
    """Filter out empty or invalid messages from the conversation."""
    def is_valid(content: str) -> bool:
        return bool(content and content.strip() and content.lower() != "undefined")
    
    return [msg for msg in conversation if is_valid(msg.content)]


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
    
    log.info(f"Provider: {request.model.provider} | Model: {request.model.name}")
    log.info(f"Web Search: {request.web_search} | Files: {len(request.files or [])}")

    # Extract history and current message
    history = request.conversation[:-1]
    current_message = request.conversation[-1]

    # Clean up orphaned files in ChromaDB
    current_filenames = [f.name for f in request.files] if request.files else []
    cleanup_orphaned_files(current_filenames)
    
    # Build RAG context using the context builder service
    context, source_map = await build_full_context(
        query=current_message.content,
        history=history,
        model=request.model,
        files=request.files,
        web_search=request.web_search,
        tavily_api_key=request.tavily_api_key
    )

    # Build final prompt
    formatted_message = build_prompt(current_message.content, context, source_map)
    request.conversation = history + [formatted_message]

    # Create request state and dispatch to provider
    state = RequestState(request_id, app)
    
    try:
        return await chat_stream(request, state, source_map)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
