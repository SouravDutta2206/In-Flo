"""
Groq provider - Groq API streaming with thinking/reasoning support.
"""
import sys
sys.dont_write_bytecode = True

from typing import AsyncIterator, Optional
from groq import Groq

from providers.base import convert_messages
from utils.schemas import ChatRequest


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
