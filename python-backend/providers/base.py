"""
Base utilities for all LLM providers - shared streaming and formatting functions.
"""
import asyncio
import json
from typing import AsyncIterator, Optional, Union

from utils.schemas import RequestState


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
