"""
Gemini provider - Google Gemini API streaming with thinking support.
"""
from typing import AsyncIterator, Optional
from google import genai
from google.genai import types
from utils.schemas import ChatRequest

def gemini_prompt_format(prompt: list):

    content = []

    for i, message in enumerate(prompt):

        if message.role == "user":
            content.append(types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=f"""{message.content}"""),
                ],
            ))
            
        if message.role == "assistant":
            content.append(types.Content(
                role="model",
                parts=[
                    types.Part.from_text(text=f"""{message.content}"""),
                ],
            ))

    return content

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


async def gemini_completion(request: ChatRequest) -> str:
    """Non-streaming chat completion for Gemini."""
    client = genai.Client(api_key=request.model.key)
    prompt = gemini_prompt_format(request.conversation)
    
    response = client.models.generate_content(
        model=request.model.name,
        contents=prompt
    )
    return response.text.strip()
