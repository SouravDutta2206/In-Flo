"""
OpenRouter provider - OpenRouter API streaming (OpenAI-compatible).
"""
import sys
sys.dont_write_bytecode = True

from typing import AsyncIterator, Optional
from openai import OpenAI

from providers.base import convert_messages
from utils.schemas import ChatRequest


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
