"""
Query functions - handles streaming chat responses from various LLM providers.
"""
import sys
sys.dont_write_bytecode = True

import asyncio
import json
from typing import AsyncIterator, Callable, Optional
from fastapi.responses import StreamingResponse

import ollama
from groq import Groq
from openai import OpenAI
from huggingface_hub import InferenceClient
from google import genai
from google.genai import types

from utils.prompts import gemini_prompt_format
from utils.schemas import ChatRequest, RequestState


async def format_chunk(content: str, model: str, sources: Optional[dict] = None) -> str:
    """Format a chunk for SSE streaming."""
    data = {"content": content, "model": model}
    if sources is not None:
        data["sources"] = sources
    return f"data: {json.dumps(data)}\n\n"


async def stream_with_sources(
    chunk_iterator: AsyncIterator[str],
    model_name: str,
    state: RequestState,
    sources: Optional[dict] = None
) -> AsyncIterator[str]:
    """
    Wrap a chunk iterator with source injection and state checking.
    Sources are sent only with the first chunk.
    """
    sent_sources = False
    try:
        async for content in chunk_iterator:
            if state.is_disconnected():
                break
            if content:
                if not sent_sources and sources:
                    yield await format_chunk(content, model_name, sources)
                    sent_sources = True
                else:
                    yield await format_chunk(content, model_name)
                await asyncio.sleep(0.01)
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


def create_streaming_response(
    generator: Callable[[], AsyncIterator[str]]
) -> StreamingResponse:
    """Create a StreamingResponse from a generator function."""
    return StreamingResponse(generator(), media_type="text/event-stream")


# Provider-specific chunk extractors

async def ollama_chunks(request: ChatRequest) -> AsyncIterator[str]:
    """Extract content chunks from Ollama stream."""
    messages = [{"role": msg.role, "content": msg.content} for msg in request.conversation]
    stream = ollama.chat(model=request.model.name, messages=messages, stream=True)
    for chunk in stream:
        if chunk and chunk.get('message', {}).get('content'):
            yield chunk['message']['content']


async def openai_compatible_chunks(client, request: ChatRequest) -> AsyncIterator[str]:
    """Extract content chunks from OpenAI-compatible stream (Groq, OpenRouter, HuggingFace)."""
    messages = [{"role": msg.role, "content": msg.content} for msg in request.conversation]
    stream = client.chat.completions.create(
        model=request.model.name,
        messages=messages,
        stream=True,
    )
    for chunk in stream:
        if chunk and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


async def gemini_chunks(request: ChatRequest) -> AsyncIterator[str]:
    """Extract content chunks from Gemini stream."""
    client = genai.Client(api_key=request.model.key)
    config = types.GenerateContentConfig(response_mime_type="text/plain")
    prompt = gemini_prompt_format(request.conversation)
    
    chunks = client.models.generate_content_stream(
        model=request.model.name,
        contents=prompt,
        config=config
    )
    for chunk in chunks:
        if chunk.text:
            yield chunk.text


# Public chat functions

async def chat_ollama(request: ChatRequest, state: RequestState, sources: Optional[dict] = None):
    """Stream chat response from Ollama."""
    async def generate():
        async for chunk in stream_with_sources(
            ollama_chunks(request), request.model.name, state, sources
        ):
            yield chunk
    return create_streaming_response(generate)


async def chat_huggingface(request: ChatRequest, state: RequestState, sources: Optional[dict] = None):
    """Stream chat response from HuggingFace."""
    client = InferenceClient(request.model.name, token=request.model.key)
    
    async def generate():
        async for chunk in stream_with_sources(
            openai_compatible_chunks(client, request), request.model.name, state, sources
        ):
            yield chunk
    return create_streaming_response(generate)


async def chat_openrouter(request: ChatRequest, state: RequestState, sources: Optional[dict] = None):
    """Stream chat response from OpenRouter."""
    client = OpenAI(api_key=request.model.key, base_url='https://openrouter.ai/api/v1')
    
    async def generate():
        async for chunk in stream_with_sources(
            openai_compatible_chunks(client, request), request.model.name, state, sources
        ):
            yield chunk
    return create_streaming_response(generate)


async def chat_groq(request: ChatRequest, state: RequestState, sources: Optional[dict] = None):
    """Stream chat response from Groq."""
    client = Groq(api_key=request.model.key)
    
    async def generate():
        async for chunk in stream_with_sources(
            openai_compatible_chunks(client, request), request.model.name, state, sources
        ):
            yield chunk
    return create_streaming_response(generate)


async def chat_gemini(request: ChatRequest, state: RequestState, sources: Optional[dict] = None):
    """Stream chat response from Gemini."""
    async def generate():
        async for chunk in stream_with_sources(
            gemini_chunks(request), request.model.name, state, sources
        ):
            yield chunk
    return create_streaming_response(generate)
