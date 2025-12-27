"""
Query functions - handles streaming chat responses from various LLM providers.
"""
import sys
sys.dont_write_bytecode = True

import asyncio
import json
from typing import AsyncIterator, Callable, Optional, Union

from fastapi.responses import StreamingResponse

import ollama
from groq import Groq
from openai import OpenAI
from huggingface_hub import InferenceClient
from google import genai
from google.genai import types

from utils.prompts import gemini_prompt_format
from utils.schemas import ChatRequest, RequestState


# Type alias for chunk iterators
ChunkIterator = AsyncIterator[Union[str, tuple[str, Optional[str]]]]


def convert_messages(conversation: list) -> list[dict]:
    """Convert conversation messages to dict format for API calls."""
    return [{"role": msg.role, "content": msg.content} for msg in conversation]


async def format_chunk(
    content: str,
    model: str,
    sources: Optional[dict] = None,
    thinking: Optional[str] = None
) -> str:
    """Format a chunk for SSE streaming."""
    data = {"content": content, "model": model}
    if sources is not None:
        data["sources"] = sources
    if thinking is not None:
        data["thinking"] = thinking
    return f"data: {json.dumps(data)}\n\n"


async def stream_response(
    chunk_iterator: ChunkIterator,
    model_name: str,
    state: RequestState,
    sources: Optional[dict] = None
) -> AsyncIterator[str]:
    """
    Universal streaming wrapper that handles both simple chunks and (content, thinking) tuples.
    Sources are sent only with the first chunk.
    """
    sent_sources = False
    try:
        async for chunk in chunk_iterator:
            if state.is_disconnected():
                break
            
            # Normalize chunk to (content, thinking) tuple
            if isinstance(chunk, tuple):
                content, thinking = chunk
            else:
                content, thinking = chunk, None
            
            if content or thinking:
                if not sent_sources and sources:
                    yield await format_chunk(content, model_name, sources, thinking)
                    sent_sources = True
                else:
                    yield await format_chunk(content, model_name, thinking=thinking)
                await asyncio.sleep(0.01)
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


# Provider-specific chunk generators

async def ollama_chunks(request: ChatRequest) -> AsyncIterator[tuple[str, Optional[str]]]:
    """Extract content and thinking chunks from Ollama stream."""
    messages = convert_messages(request.conversation)
    stream = ollama.chat(model=request.model.name, messages=messages, stream=True)
    for chunk in stream:
        if chunk:
            message = chunk.get('message', {})
            content = message.get('content') or ''
            thinking = message.get('thinking')
            if content or thinking:
                yield (content, thinking)


async def huggingface_chunks(request: ChatRequest) -> AsyncIterator[str]:
    """Extract content chunks from HuggingFace stream."""
    client = InferenceClient(request.model.name, token=request.model.key)
    messages = convert_messages(request.conversation)
    stream = client.chat.completions.create(
        model=request.model.name,
        messages=messages,
        stream=True,
    )
    for chunk in stream:
        if chunk and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


async def openrouter_chunks(request: ChatRequest) -> AsyncIterator[tuple[str, Optional[str]]]:
    """Extract content and reasoning chunks from OpenRouter stream."""
    client = OpenAI(api_key=request.model.key, base_url='https://openrouter.ai/api/v1')
    messages = convert_messages(request.conversation)
    stream = client.chat.completions.create(
        model=request.model.name,
        messages=messages,
        stream=True,
    )
    for chunk in stream:
        if chunk and chunk.choices:
            delta = chunk.choices[0].delta
            content = getattr(delta, 'content', None) or ''
            reasoning = getattr(delta, 'reasoning', None)
            if content or reasoning:
                yield (content, reasoning)


async def groq_chunks(request: ChatRequest) -> AsyncIterator[tuple[str, Optional[str]]]:
    """
    Extract content and reasoning chunks from Groq stream.
    Handles both 'reasoning' field and <think></think> tag parsing.
    """
    client = Groq(api_key=request.model.key)
    messages = convert_messages(request.conversation)
    stream = client.chat.completions.create(
        model=request.model.name,
        messages=messages,
        stream=True,
    )
    
    in_think_block = False
    
    for chunk in stream:
        if not (chunk and chunk.choices):
            continue
            
        delta = chunk.choices[0].delta
        content = getattr(delta, 'content', None) or ''
        reasoning = getattr(delta, 'reasoning', None)
        
        # If reasoning field exists, use it directly
        if reasoning:
            yield ('', reasoning)
            if content:
                yield (content, None)
            continue
        
        if not content:
            continue
            
        # Parse <think></think> tags from content
        result_content, result_thinking = "", ""
        temp_content = content
        
        while temp_content:
            if not in_think_block:
                think_start = temp_content.find('<think>')
                if think_start != -1:
                    result_content += temp_content[:think_start]
                    temp_content = temp_content[think_start + 7:]
                    in_think_block = True
                else:
                    result_content += temp_content
                    temp_content = ""
            else:
                think_end = temp_content.find('</think>')
                if think_end != -1:
                    result_thinking += temp_content[:think_end]
                    temp_content = temp_content[think_end + 8:]
                    in_think_block = False
                else:
                    result_thinking += temp_content
                    temp_content = ""
        
        if result_content or result_thinking:
            yield (result_content, result_thinking or None)


async def gemini_chunks(request: ChatRequest) -> AsyncIterator[tuple[str, Optional[str]]]:
    """Extract content and thinking chunks from Gemini stream."""
    client = genai.Client(api_key=request.model.key)
    config = types.GenerateContentConfig(
        response_mime_type="text/plain",
        thinking_config=types.ThinkingConfig(thinking_level="HIGH", include_thoughts=True)
    )
    prompt = gemini_prompt_format(request.conversation)
    
    stream = client.models.generate_content_stream(
        model=request.model.name,
        contents=prompt,
        config=config
    )
    
    for chunk in stream:
        if not chunk.candidates:
            continue
            
        for candidate in chunk.candidates:
            parts = getattr(candidate.content, 'parts', None) if candidate.content else None
            if not parts:
                continue
            
            content, thinking = "", ""
            for part in parts:
                text = getattr(part, 'text', '') or ''
                if getattr(part, 'thought', False):
                    thinking += text
                else:
                    content += text
            
            if content or thinking:
                yield (content, thinking or None)


# Provider dispatch and public API

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

