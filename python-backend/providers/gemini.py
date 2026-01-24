"""
Gemini provider - Google Gemini API streaming with thinking support.
"""
import sys
sys.dont_write_bytecode = True

from typing import AsyncIterator, Optional
from google import genai
from google.genai import types

from utils.prompts import gemini_prompt_format
from utils.schemas import ChatRequest


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
