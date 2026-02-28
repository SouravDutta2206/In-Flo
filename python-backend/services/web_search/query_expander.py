from typing import List, Optional

from utils.schemas import Message, ModelInfo, ChatRequest
from utils.logging import query_expander_logger
from config import ENABLE_QUERY_EXPANSION, QUERY_EXPANSION_MAX_HISTORY
from providers import chat_completion
from utils.prompts import QUERY_EXPANSION_PROMPT

log = query_expander_logger()


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
        log.debug("Disabled via config")
        return query
    
    try:
        # Build the expansion prompt
        conversation_context = _format_conversation_history(conversation_history)
        expansion_prompt = QUERY_EXPANSION_PROMPT.format(
            conversation_context=conversation_context,
            user_query=query
        )
        
        # Create a mini ChatRequest for the expansion
        expansion_request = ChatRequest(
            model=model,
            conversation=[Message(role="user", content=expansion_prompt)]
        )
        
        # Use the unified provider completion
        expanded = await chat_completion(expansion_request)
        
        # Validate the expanded query
        if not expanded or len(expanded) < 3:
            log.warning("Expansion too short, using original query")
            return query
        
        # Limit length to avoid overly long search queries
        if len(expanded) > 150:
            expanded = expanded[:150]
        
        return expanded
        
    except Exception as e:
        log.error(f"Error during expansion: {e}")
        return query
