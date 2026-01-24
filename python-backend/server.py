import os
import sys
sys.dont_write_bytecode = True

from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List, Optional
import time

from utils.prompts import base_prompt, prompt_with_context
from utils.model_list import get_gemini_models_list, get_groq_models_list
from utils.schemas import ModelResponse, ModelRequest, ModelID, ChatRequest, Message, RequestState, FileUploadResponse
from utils.query_func import chat_stream
from utils.web_search.search import search_and_scrape as search
from utils.faiss import chunk_docs, faiss_search
from utils.pdf_processing import extract_pages_with_chunks
from utils.vector_store import add_documents, query_documents, delete_documents, clear_database, get_all_filenames
from utils.sources import process_search_results


app = FastAPI(
    title="LLM Chat API",
    description="API for interacting with various LLM models with streaming support",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

clear_database()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app lifecycle - initialize and cleanup request tracking."""
    # Clear file upload database at startup for fresh state
    print("[STARTUP] File upload database cleared")
    
    app.state.active_requests = set()
    print("Server started, request tracking initialized")
    yield
    app.state.active_requests.clear()
    print("Server shutdown, request tracking cleared")

app.lifespan = lifespan


# Helper functions

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
        formatted = prompt_with_context(context=context, query=query, source_map=source_map or {})
    else:
        formatted = base_prompt(query)
    
    return Message(role="user", content=formatted[0]["content"])


# API Endpoints

@app.post("/api/files/process")
async def process_file_endpoint(file: UploadFile = File(...)):
    """
    Process an uploaded PDF file, chunk it, and store in ChromaDB.
    
    Returns:
        FileUploadResponse with name, token count, chunk count, and status
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        content = await file.read()
        
        # Extract chunks with page metadata
        chunks, metadatas, tokens = extract_pages_with_chunks(file.filename, content)
        
        if not chunks:
            raise ValueError("Could not extract text from PDF")
        
        # Delete any existing chunks for this file (re-upload case)
        delete_documents([file.filename])
        
        # Add to ChromaDB
        chunk_count = add_documents(chunks, metadatas, file.filename)
        
        return FileUploadResponse(
            name=file.filename,
            tokens=tokens,
            chunks=chunk_count,
            status="uploaded"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


@app.delete("/api/files/clear")
async def clear_files_endpoint():
    """
    Clear the entire file upload database.
    Called when user clicks "clear all" or wants to start fresh.
    
    Returns:
        Success status
    """
    try:
        success = clear_database()
        if success:
            return {"status": "cleared", "message": "All files cleared successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to clear database")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing files: {str(e)}")


@app.post("/api/gemini/models")
async def get_gemini_models(request: ModelRequest):
    """Get available Gemini models."""
    try:
        models = get_gemini_models_list(api_key=request.api_key)
        return ModelResponse(data=[ModelID(id=model) for model in models])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/groq/models")
async def get_groq_models(request: ModelRequest):
    """Get available Groq models."""
    try:
        models = get_groq_models_list(api_key=request.api_key)
        return ModelResponse(data=[ModelID(id=model.get('id')) for model in models])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/chat")
async def chat(request: ChatRequest, background_tasks: BackgroundTasks):
    """Handle chat request with streaming response."""
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
        web_context, web_source_map = await process_web_search(
            current_message.content, 
            request.tavily_api_key
        )


    # Clean up orphaned files in ChromaDB (files deleted from frontend)
    # Get current files from request
    current_filenames = [f.name for f in request.files] if request.files else []
    
    # Get all files in ChromaDB
    db_filenames = get_all_filenames()
    
    # Find orphaned files (in DB but not in current request)
    orphaned = [f for f in db_filenames if f not in current_filenames]
    
    # Delete orphaned files
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
