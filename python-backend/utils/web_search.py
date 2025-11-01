import asyncio
import os
process_env = os.environ.copy()
process_env["PYTHONIOENCODING"] = "utf-8"

import sys
if sys.platform.startswith('win'):
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from ddgs import DDGS
from tavily import TavilyClient

from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode, BrowserConfig
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator
from crawl4ai.content_filter_strategy import PruningContentFilter

from langchain_core.documents import Document


def ddgs_search(query : str) -> list[str]:

    print("Using DuckDuckGo Search...")
    results = DDGS().text(query, max_results=5)
    return [sites['href'] for sites in results]

def tavily_search(query : str, exclusions: list[str], api_key: str = "") -> list[str]:

    print("Using Tavily Search...")
    tavily_client = TavilyClient(api_key=api_key)
    response = tavily_client.search(query, exclude_domains=exclusions)
    return [result['url'] for result in response['results']]

def web_search_urls(query : str, tavily_api_key: str = "") -> list[str]:

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
        urls = ddgs_search(query=query)
    except Exception as e:
        print(f"DuckDuckGo Search Failed: {e}")
        urls = []

    if not urls:
        try:
            urls = tavily_search(query=query, exclusions=[e.replace('https://www.', '').replace('https://', '') for e in exclusions], api_key=tavily_api_key)
        except Exception as e:
            print(f"Tavily Search Failed: {e}")
            urls = []

    return urls

async def get_webpage_data(urls : list) -> list[Document]:

    if not urls:
        return []

    docs = []

    browser_config = BrowserConfig(headless=True, text_mode=True, light_mode=True)

    md_generator = DefaultMarkdownGenerator(
        content_source="cleaned_html",
        options={
            "ignore_links" : True,
            "escape_html" : False,
            "ignore_images" : True,
            "skip_internal_links" : True,   
        },
        content_filter=PruningContentFilter(
            threshold=0.5,
            threshold_type='dynamic'
        )
    )

    run_conf = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        stream=False,
        markdown_generator=md_generator,
        excluded_tags=["nav", "footer", "header", "form", "img", "a"],
        only_text=True,
        exclude_social_media_links=True,
        exclude_external_links=True,
        keep_data_attributes=False,
        remove_overlay_elements=True,
        verbose=True,
        scan_full_page=True,
        magic=True,
    )
    
    try:
        async with AsyncWebCrawler(config=browser_config) as crawler:
            results = await crawler.arun_many(urls=urls, config=run_conf)
            for result in results:
                doc = Document(
                    metadata={"source": result.url},
                    page_content=result.markdown.fit_markdown
                )
                docs.append(doc)
    except Exception as e:
        print(f"Webpage Crawling Failed: {e}")
    finally:
        return docs

async def web_search(user_query: str, tavily_api_key: str = "") -> list[Document]:
    search_results = web_search_urls(user_query, tavily_api_key=tavily_api_key)
    docs = await get_webpage_data(search_results)
    if not docs:
        docs = []
    return docs



    




