import asyncio
import os
process_env = os.environ.copy()
process_env["PYTHONIOENCODING"] = "utf-8"
import subprocess
import sys
sys.dont_write_bytecode = True

#server
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import json
from utils.prompts import base_prompt, prompt_with_context
from utils.model_list import get_gemini_models_list, get_groq_models_list
from contextlib import asynccontextmanager
from utils.schemas import ModelResponse, ModelRequest, ModelID, ChatRequest, Message, RequestState
from utils.query_func import chat_ollama, chat_huggingface, chat_openrouter, chat_groq, chat_gemini
from utils.web_search import web_search
from utils.faiss import chunk_docs, faiss_search

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

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize request state storage on startup
    app.state.active_requests = set()
    print("Initialized active_requests set")
    yield
    # Cleanup on shutdown
    app.state.active_requests.clear()
    print("Cleared active_requests set")

app.lifespan = lifespan

async def format_chunk(content: str, model: str) -> str:
    """Format a chunk for SSE streaming"""
    data = {
        "content": content,
        "model": model
    }
    return f"data: {json.dumps(data)}\n\n"

def filter_conversation(conversation: List[Message]) -> List[Message]:
    # Filter out empty or invalid messages from the conversation
    def is_valid_content(content: str) -> bool:
        if content is None:
            return False
        if content.lower() == "undefined":
            return False
        if not content.strip():  # Handles "", " ", and whitespace-only strings
            return False
        return True

    return [
        msg for msg in conversation 
        if is_valid_content(msg.content)
    ]

@app.post("/api/gemini/models")
async def get_gemini_models(request: ModelRequest):
    try:

        # Get available models
        models = get_gemini_models_list(api_key=request.api_key)
        
        response = ModelResponse(
            data=[ModelID(id=model) for model in models]
        )
        
        return response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/groq/models")
async def get_groq_models(request: ModelRequest):
    try:
        
        # Get available models
        models = get_groq_models_list(api_key=request.api_key)
               
        response = ModelResponse(
            data=[ModelID(id=model.get('id')) for model in models]
        )
        
        return response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/chat")
async def chat(request: ChatRequest, background_tasks: BackgroundTasks):
    # Add request to active requests
    request_id = id(request)
    
    # Ensure active_requests exists
    if not hasattr(app.state, 'active_requests'):
        app.state.active_requests = set()
    
    app.state.active_requests.add(request_id)
    print(f"Added request {request_id} to active_requests")
    
    # Add cleanup task
    async def cleanup():
        if hasattr(app.state, 'active_requests'):
            app.state.active_requests.remove(request_id)
            print(f"Removed request {request_id} from active_requests")
    
    background_tasks.add_task(cleanup)

    # Filter out empty messages before any processing
    request.conversation = filter_conversation(request.conversation)

    print(f"Provider: {request.model.provider}")
    print(f"Model Name: {request.model.name}")
    print(f"Web Search: {request.web_search}")

    history = request.conversation[:-1]
    current_message = request.conversation[-1]
        
    if request.web_search:
        web_results = await web_search(user_query=current_message.content)
        if web_results:
            web_results = chunk_docs(docs=web_results)
            web_search_results = faiss_search(chunks=web_results, user_query=current_message.content)
        else:
            web_search_results = ""        
    else:
        web_search_results = ""
        # sources = []

    # sources = []
    system_prompt = web_search_results
    # sources = sources + sources

    if system_prompt:
        formatted_prompt = prompt_with_context(context=web_search_results, query=current_message.content)
    else:
        formatted_prompt = base_prompt(current_message.content)

    formatted_message = Message(
        role="user",
        content=formatted_prompt[0]["content"]
    )
    
    request.conversation = history + [formatted_message]

    # Create request state
    state = RequestState(request_id, app)

    return await handle_chat_request(request, state, request.model.provider.lower())

async def handle_chat_request(chat_request: ChatRequest, state: RequestState, provider: str):
    if provider == "ollama":
        return await chat_ollama(chat_request, state)
    elif provider == "huggingface":
        return await chat_huggingface(chat_request, state)
    elif provider == "openrouter":
        return await chat_openrouter(chat_request, state)
    elif provider == "groq":
        return await chat_groq(chat_request, state)
    elif provider == "gemini":
        return await chat_gemini(chat_request, state)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")



if __name__ == "__main__":

    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 