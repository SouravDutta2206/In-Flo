"""
Ollama provider - local LLM streaming via Ollama.
"""
import sys
sys.dont_write_bytecode = True

from typing import AsyncIterator, Optional
import ollama

from providers.base import convert_messages
from utils.schemas import ChatRequest


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
