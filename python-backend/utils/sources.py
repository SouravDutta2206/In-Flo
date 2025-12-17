"""
Sources module - handles source map creation and context formatting for RAG.
"""
from dataclasses import dataclass
from typing import Any


@dataclass
class Source:
    """A single source with URL, relevance score, and snippet preview."""
    url: str
    score: float
    snippet: str


def build_source_map(
    results: list[tuple[str, float, str]], 
    snippet_length: int = 200
) -> dict[int, dict[str, any]]:
    """
    Build a source map from search results.
    
    Args:
        results: List of (chunk_content, score, source_url) tuples
        snippet_length: Max length for snippet preview
        
    Returns:
        Dict mapping source IDs (1-indexed) to source info
    """
    return {
        idx: {
            "url": source_url,
            "score": score,
            "snippet": chunk[:snippet_length] + "..." if len(chunk) > snippet_length else chunk
        }
        for idx, (chunk, score, source_url) in enumerate(results, 1)
    }


def format_context(results: list[tuple[str, float, str]]) -> str:
    """
    Format search results as context string for LLM prompt.
    
    Args:
        results: List of (chunk_content, score, source_url) tuples
        
    Returns:
        Formatted context string with source IDs
    """
    if not results:
        return ""
    
    context_parts = [
        f"<source_id='{idx}'>\n{chunk}\n</source_id>"
        for idx, (chunk, _, _) in enumerate(results, 1)
    ]
    return "\n\n".join(context_parts)


def process_search_results(
    results: list[tuple[str, float, str]],
    snippet_length: int = 200
) -> tuple[str, dict[int, dict[str, any]]]:
    """
    Process search results into context string and source map.
    
    Args:
        results: List of (chunk_content, score, source_url) tuples
        snippet_length: Max length for snippet preview
        
    Returns:
        Tuple of (context_string, source_map)
    """
    if not results:
        return "", {}
    
    context = format_context(results)
    source_map = build_source_map(results, snippet_length)
    
    print(f"\nProcessed {len(results)} sources, context length: {len(context)}")
    
    return context, source_map
