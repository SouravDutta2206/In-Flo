"""
HuggingFace provider - HuggingFace Inference API streaming.
"""
import sys
sys.dont_write_bytecode = True

from typing import AsyncIterator
from huggingface_hub import InferenceClient

from providers.base import convert_messages
from utils.schemas import ChatRequest


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
