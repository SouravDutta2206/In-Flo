"""
Providers package - LLM provider implementations for streaming chat.
"""
from typing import Optional
from fastapi.responses import StreamingResponse

from providers.base import stream_response
from providers.ollama import ollama_chunks, ollama_completion
from providers.huggingface import huggingface_chunks, huggingface_completion
from providers.openrouter import openrouter_chunks, openrouter_completion
from providers.groq import groq_chunks, groq_completion
from providers.gemini import gemini_chunks, gemini_completion
from utils.schemas import ChatRequest, RequestState


CHUNK_GENERATORS = {
    "ollama": ollama_chunks,
    "huggingface": huggingface_chunks,
    "openrouter": openrouter_chunks,
    "groq": groq_chunks,
    "gemini": gemini_chunks,
}

COMPLETION_PROVIDERS = {
    "ollama": ollama_completion,
    "huggingface": huggingface_completion,
    "openrouter": openrouter_completion,
    "groq": groq_completion,
    "gemini": gemini_completion,
}


async def chat_stream(
    request: ChatRequest,
    state: RequestState,
    sources: Optional[dict] = None,
    provider: Optional[str] = None
) -> StreamingResponse:
    """
    Stream chat response from any supported provider.
    
    Args:
        request: The chat request with model and conversation
        state: Request state for tracking disconnection
        sources: Optional source map to send with first chunk
        provider: Provider name (defaults to request.model.provider)
    """
    provider = (provider or request.model.provider).lower()
    
    chunk_generator = CHUNK_GENERATORS.get(provider)
    if not chunk_generator:
        raise ValueError(f"Unsupported provider: {provider}")
    
    async def generate():
        async for chunk in stream_response(
            chunk_generator(request), request.model.name, state, sources
        ):
            yield chunk
    
    return StreamingResponse(generate(), media_type="text/event-stream")


async def chat_completion(
    request: ChatRequest,
    provider: Optional[str] = None
) -> str:
    """
    Get non-streaming chat response from any supported provider.
    
    Args:
        request: The chat request with model and conversation
        provider: Provider name (defaults to request.model.provider)
    """
    provider = (provider or request.model.provider).lower()
    
    completion_fn = COMPLETION_PROVIDERS.get(provider)
    if not completion_fn:
        raise ValueError(f"Unsupported provider: {provider}")
    
    return await completion_fn(request)
