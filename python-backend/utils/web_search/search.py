"""
DuckDuckGo Search Integration
Search for URLs, scrape content, return LangChain Documents.
"""

import asyncio
from langchain_core.documents import Document
from ddgs import DDGS
from utils.web_search.scraper import scrape_urls_async
from tavily import TavilyClient


async def search_duckduckgo(query: str, num_results: int = 10) -> list[str]:
    """
    Search DuckDuckGo and return list of URLs.
    
    Args:
        query: Search query string
        num_results: Number of results to fetch
    
    Returns:
        List of URLs from search results
    """
    # DDGS is sync, so run in executor to not block
    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(
        None, 
        lambda: DDGS().text(query, max_results=num_results)
    )
    urls = [r['href'] for r in results if 'href' in r]
    unique_urls = list(dict.fromkeys(urls))
    return unique_urls

async def search_tavily(query: str, exclusions: list[str], api_key: str = "", num_results: int = 10) -> list[str]:
    """
    Search Tavily and return list of URLs.
    
    Args:
        query: Search query string
        exclusions: List of domains to exclude
        api_key: Tavily API key
        num_results: Number of results to fetch
    Returns:
        List of URLs from search results
    """
    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(
        None,
        lambda: TavilyClient(api_key=api_key).search(query=query, exclude_domains=exclusions, max_results=num_results)
    )
    urls = [result['url'] for result in results['results']]
    unique_urls = list(dict.fromkeys(urls))
    return unique_urls

async def search_and_scrape(
    query: str,
    target_count: int = 5,
    max_attempts: int = 5,
    tavily_api_key: str = ""
) -> list[Document]:
    """
    Search DuckDuckGo, scrape URLs, retry until target_count usable results.
    
    Args:
        query: Search query string
        target_count: Number of successful results needed
        max_attempts: Maximum search attempts to prevent infinite loops
    
    Returns:
        List of LangChain Document objects
    """
    successful_documents: list[Document] = []
    seen_urls: set[str] = set()
    attempt = 0
    offset = 0
    
    print(f"\n[SEARCH] Query: '{query}' | Target: {target_count} results\n")
    
    while len(successful_documents) < target_count and attempt < max_attempts:
        
        attempt += 1
        needed = target_count - len(successful_documents)
        
        # Fetch more URLs than needed to account for failures
        fetch_count = needed + 5 + offset
        print(f"[SEARCH] Attempt {attempt}: Fetching {fetch_count} URLs...")

        exclusions = [
        'https://en.wikipedia.org',
        'https://www.britannica.com',
        'https://www.quora.com', 
        'https://www.reddit.com', 
        'https://www.youtube.com'
        ]
    
        exclusion_str = ' '.join([f'-site:{e}' for e in exclusions])
        query = f"{query} {exclusion_str}"

        urls = []

        try:
            print(f"[SEARCH] Trying DuckDuckGo search...")
            urls = await search_duckduckgo(query, num_results=fetch_count)
        except Exception as e:
            print(f"[SEARCH] DuckDuckGo search failed: {e}")
            urls = []
        
        if not urls:
            try:
                print(f"[SEARCH] Trying Tavily search...")
                urls = await search_tavily(query=query, exclusions=[e.replace('https://www.', '').replace('https://', '') for e in exclusions], api_key=tavily_api_key, num_results=fetch_count)
            except Exception as e:
                print(f"[SEARCH] Tavily search failed: {e}")
                urls = []

        # Filter out already seen URLs
        new_urls = [url for url in urls if url not in seen_urls]
        seen_urls.update(new_urls)
        
        if not new_urls:
            print(f"[SEARCH] No new URLs found, stopping.")
            break
        
        print(f"[SEARCH] Found {len(new_urls)} new URLs to scrape\n")
        
        # Scrape the new URLs (returns Documents now)
        documents = await scrape_urls_async(new_urls)
        successful_documents.extend(documents)
        
        # Increase offset for next search to get different results
        offset += fetch_count
        
        print(f"\n[SEARCH] Progress: {len(successful_documents)}/{target_count} successful\n")
    
    # Trim to target count if we got more
    return successful_documents[:target_count]


def search_and_scrape_sync(
    query: str,
    target_count: int = 5,
    max_attempts: int = 5,
) -> list[Document]:
    """
    Synchronous wrapper for search_and_scrape.
    
    Args:
        query: Search query string
        target_count: Number of successful results needed
        max_attempts: Maximum search attempts to prevent infinite loops
    
    Returns:
        List of LangChain Document objects
    """
    return asyncio.run(search_and_scrape(query, target_count, max_attempts))


