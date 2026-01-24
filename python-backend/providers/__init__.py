"""
Providers package - LLM provider implementations for streaming chat.
"""
from typing import Optional
from fastapi.responses import StreamingResponse

from providers.base import stream_response
from providers.ollama import ollama_chunks
from providers.huggingface import huggingface_chunks
from providers.openrouter import openrouter_chunks
from providers.groq import groq_chunks
from providers.gemini import gemini_chunks
from utils.schemas import ChatRequest, RequestState


CHUNK_GENERATORS = {
    "ollama": ollama_chunks,
    "huggingface": huggingface_chunks,
    "openrouter": openrouter_chunks,
    "groq": groq_chunks,
    "gemini": gemini_chunks,
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
