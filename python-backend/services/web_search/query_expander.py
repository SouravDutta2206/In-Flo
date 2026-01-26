"""
Query Expander - Expands user queries using conversation context for better web search results.
Uses the same LLM provider that the user selected for chat.
"""
import sys
sys.dont_write_bytecode = True

from typing import List, Optional
import ollama
from openai import OpenAI
from groq import Groq
from google import genai

from utils.schemas import Message, ModelInfo
from config import ENABLE_QUERY_EXPANSION, QUERY_EXPANSION_MAX_HISTORY


QUERY_EXPANSION_PROMPT = """You are a search query optimizer. Your task is to analyze the conversation context and generate an optimized web search query.

{conversation_context}

Current User Question:
{user_query}

Generate a concise, keyword-rich search query (under 100 characters) that will help find the most relevant information on the web. Consider:
1. Key entities and topics from the conversation
2. Specific details mentioned by the user
3. Temporal context (if the user wants recent/latest information, include that)
4. Remove conversational fluff, keep only search-relevant terms

Output ONLY the optimized search query, nothing else."""


def _format_conversation_history(history: List[Message]) -> str:
    """Format conversation history for the expansion prompt."""
    if not history:
        return "No previous conversation."
    
    # Take only the last N messages as configured
    recent_history = history[-QUERY_EXPANSION_MAX_HISTORY:]
    
    formatted = []
    for msg in recent_history:
        role = "User" if msg.role == "user" else "Assistant"
        # Truncate long messages to avoid token bloat
        content = msg.content[:500] + "..." if len(msg.content) > 500 else msg.content
        formatted.append(f"{role}: {content}")
    
    return "Conversation History:\n" + "\n".join(formatted)


def _build_expansion_messages(query: str, history: List[Message]) -> List[dict]:
    """Build the messages for the expansion prompt."""
    conversation_context = _format_conversation_history(history)
    prompt = QUERY_EXPANSION_PROMPT.format(
        conversation_context=conversation_context,
        user_query=query
    )
    return [{"role": "user", "content": prompt}]


async def _expand_with_ollama(query: str, history: List[Message], model: ModelInfo) -> str:
    """Expand query using Ollama provider."""
    messages = _build_expansion_messages(query, history)
    response = ollama.chat(model=model.name, messages=messages, stream=False)
    return response.get('message', {}).get('content', query).strip()


async def _expand_with_groq(query: str, history: List[Message], model: ModelInfo) -> str:
    """Expand query using Groq provider."""
    client = Groq(api_key=model.key)
    messages = _build_expansion_messages(query, history)
    response = client.chat.completions.create(
        model=model.name,
        messages=messages,
        stream=False,
    )
    return response.choices[0].message.content.strip()


async def _expand_with_openrouter(query: str, history: List[Message], model: ModelInfo) -> str:
    """Expand query using OpenRouter provider."""
    client = OpenAI(api_key=model.key, base_url='https://openrouter.ai/api/v1')
    messages = _build_expansion_messages(query, history)
    response = client.chat.completions.create(
        model=model.name,
        messages=messages,
        stream=False,
    )
    return response.choices[0].message.content.strip()


async def _expand_with_huggingface(query: str, history: List[Message], model: ModelInfo) -> str:
    """Expand query using HuggingFace provider."""
    client = OpenAI(api_key=model.key, base_url='https://api-inference.huggingface.co/v1/')
    messages = _build_expansion_messages(query, history)
    response = client.chat.completions.create(
        model=model.name,
        messages=messages,
        stream=False,
    )
    return response.choices[0].message.content.strip()


async def _expand_with_gemini(query: str, history: List[Message], model: ModelInfo) -> str:
    """Expand query using Gemini provider."""
    client = genai.Client(api_key=model.key)
    messages = _build_expansion_messages(query, history)
    
    response = client.models.generate_content(
        model=model.name,
        contents=messages[0]["content"]
    )
    return response.text.strip()


# Provider mapping for expansion functions
_EXPANSION_PROVIDERS = {
    "ollama": _expand_with_ollama,
    "groq": _expand_with_groq,
    "openrouter": _expand_with_openrouter,
    "huggingface": _expand_with_huggingface,
    "gemini": _expand_with_gemini,
}


async def expand_search_query(
    query: str,
    conversation_history: List[Message],
    model: ModelInfo
) -> str:
    """
    Expand the user's search query using conversation context.
    
    Uses the same LLM provider that the user selected for chat to analyze
    the conversation history and generate an optimized search query.
    
    Args:
        query: The user's original query
        conversation_history: Previous messages in the conversation
        model: The model info (provider, name, key) from the chat request
    
    Returns:
        Expanded search query, or original query if expansion fails
    """
    # Check if expansion is enabled
    if not ENABLE_QUERY_EXPANSION:
        print("[QUERY EXPANSION] Disabled via config")
        return query
    
    provider = model.provider.lower()
    expand_fn = _EXPANSION_PROVIDERS.get(provider)
    
    if not expand_fn:
        print(f"[QUERY EXPANSION] Unsupported provider: {provider}, using original query")
        return query
    
    try:
        expanded = await expand_fn(query, conversation_history, model)
        
        # Validate the expanded query
        if not expanded or len(expanded) < 3:
            print("[QUERY EXPANSION] Expansion too short, using original query")
            return query
        
        # Limit length to avoid overly long search queries
        if len(expanded) > 150:
            expanded = expanded[:150]
        
        return expanded
        
    except Exception as e:
        print(f"[QUERY EXPANSION] Error during expansion: {e}")
        print("[QUERY EXPANSION] Falling back to original query")
        return query
