"""
Web Scraper - Fetches URLs and converts HTML to clean markdown.
Returns LangChain Document objects for easy integration.
"""

import asyncio
import re
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup, Comment
from langchain_core.documents import Document
from markdownify import markdownify as md


@dataclass
class ScrapedPage:
    """Represents a scraped page with its content."""
    url: str
    title: Optional[str]
    markdown: str
    success: bool
    error: Optional[str] = None
    
    def __repr__(self) -> str:
        status = "✓" if self.success else "✗"
        return f"ScrapedPage({status} {self.url[:50]}...)"
    
    def to_document(self) -> Document:
        """Convert ScrapedPage to LangChain Document."""
        return Document(
            metadata={"source": self.url, "title": self.title},
            page_content=self.markdown
        )


# Elements that typically don't contain useful content
NOISE_TAGS = [
    'script', 'style', 'noscript', 'iframe', 'svg', 
    'nav', 'header', 'footer', 'aside', 'form',
    'button', 'input', 'select', 'textarea',
    'advertisement', 'ads', 'social-share',
    'figure', 'figcaption', 'picture', 'source', 'img',
    'video', 'audio', 'canvas', 'map', 'object', 'embed',
]

# Classes/IDs that usually indicate non-content elements
NOISE_PATTERNS = [
    r'nav', r'menu', r'sidebar', r'footer', r'header',
    r'comment', r'social', r'share', r'advertisement', r'ads',
    r'cookie', r'popup', r'modal', r'banner', r'promo',
    r'related', r'recommended', r'subscribe', r'newsletter',
    r'breadcrumb', r'pagination', r'widget', r'tag', r'category',
    r'author', r'meta', r'byline', r'date', r'timestamp',
    r'toc', r'table-of-contents', r'jump', r'skip',
    r'link', r'btn', r'button', r'cta', r'call-to-action',
    r'more', r'read-more', r'see-also', r'also-read',
]


def clean_html(soup: BeautifulSoup) -> BeautifulSoup:
    """Remove noise elements from HTML to extract main content."""
    
    # Remove comments
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        comment.extract()
    
    # Remove noise tags
    for tag in NOISE_TAGS:
        for element in list(soup.find_all(tag)):
            element.decompose()
    
    # Remove elements with noisy class/id patterns
    noise_regex = re.compile('|'.join(NOISE_PATTERNS), re.IGNORECASE)
    elements_to_remove = []
    for element in soup.find_all(True):
        if not element.name:
            continue
        classes = ' '.join(element.get('class', []) or [])
        element_id = element.get('id', '') or ''
        if noise_regex.search(classes) or noise_regex.search(element_id):
            # Don't remove if it's likely main content
            if not any(x in classes.lower() or x in element_id.lower() 
                      for x in ['main', 'content', 'article', 'post', 'body', 'text']):
                elements_to_remove.append(element)
    for element in elements_to_remove:
        try:
            element.decompose()
        except:
            pass
    
    # Remove link lists (ul/ol that are mostly links)
    for list_elem in list(soup.find_all(['ul', 'ol'])):
        items = list_elem.find_all('li', recursive=False)
        if items:
            link_items = sum(1 for item in items if item.find('a') and len(item.get_text(strip=True)) < 100)
            if link_items / len(items) > 0.7:  # More than 70% are link items
                try:
                    list_elem.decompose()
                except:
                    pass
    
    # Remove standalone links that aren't part of text content
    links_to_remove = []
    for a_tag in soup.find_all('a'):
        parent = a_tag.parent
        if parent and parent.name in ['li', 'div', 'span']:
            parent_text = parent.get_text(strip=True)
            link_text = a_tag.get_text(strip=True)
            # If the link is almost all the text in its parent, it's likely navigation
            if parent_text and link_text and len(link_text) / len(parent_text) > 0.9:
                if len(link_text) < 80:  # Short links are usually navigation
                    links_to_remove.append(a_tag)
    for a_tag in links_to_remove:
        try:
            a_tag.decompose()
        except:
            pass
    
    # Remove divs that are primarily links
    divs_to_remove = []
    for div in soup.find_all('div'):
        if not div.name:
            continue
        text = div.get_text(strip=True)
        links = div.find_all('a')
        if links and text:
            link_text_total = sum(len(a.get_text(strip=True)) for a in links)
            if link_text_total / len(text) > 0.8:  # 80% of text is links
                divs_to_remove.append(div)
    for div in divs_to_remove:
        try:
            div.decompose()
        except:
            pass
    
    # Remove empty elements
    for element in list(soup.find_all(True)):
        try:
            if element.name and not element.get_text(strip=True):
                element.decompose()
        except:
            pass
    
    return soup


def find_main_content(soup: BeautifulSoup) -> BeautifulSoup:
    """Try to find the main content area of the page."""
    
    # Priority selectors for main content
    content_selectors = [
        'article',
        'main',
        '[role="main"]',
        '.post-content',
        '.article-content', 
        '.entry-content',
        '.content',
        '#content',
        '.post',
        '.article',
    ]
    
    for selector in content_selectors:
        content = soup.select_one(selector)
        if content and len(content.get_text(strip=True)) > 200:
            return content
    
    # Fallback: find the div with the most text content
    body = soup.find('body')
    if body:
        return body
    
    return soup


def html_to_markdown(html: str, base_url: str = "") -> tuple[Optional[str], str]:
    """
    Convert HTML to clean markdown.
    Returns (title, markdown_content).
    """
    soup = BeautifulSoup(html, 'lxml')
    
    # Extract title
    title = None
    title_tag = soup.find('title')
    if title_tag:
        title = title_tag.get_text(strip=True)
    
    # Find main content and clean it
    content = find_main_content(soup)
    content = clean_html(content)
    
    # Fix relative URLs
    if base_url:
        for tag in content.find_all(['a', 'img']):
            attr = 'href' if tag.name == 'a' else 'src'
            url = tag.get(attr, '')
            if url and not url.startswith(('http://', 'https://', 'mailto:', 'tel:', '#')):
                tag[attr] = urljoin(base_url, url)
    
    # Convert to markdown
    markdown = md(
        str(content),
        heading_style="ATX",
        bullets="-",
        strip=['script', 'style'],
    )
    
    # Clean up excessive whitespace
    markdown = re.sub(r'\n{3,}', '\n\n', markdown)
    markdown = re.sub(r' +', ' ', markdown)
    markdown = markdown.strip()
    
    return title, markdown


async def fetch_url(client: httpx.AsyncClient, url: str) -> ScrapedPage:
    """Fetch a single URL and convert to markdown."""
    print(f"[START] {url}")
    try:
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()
        print(f"[FETCH] {url}")
        
        # Check if it's HTML
        content_type = response.headers.get('content-type', '')
        if 'text/html' not in content_type.lower():
            print(f"[ERROR] {url} - Not HTML content: {content_type}")
            return ScrapedPage(
                url=url,
                title=None,
                markdown="",
                success=False,
                error=f"Not HTML content: {content_type}"
            )
        
        title, markdown = html_to_markdown(response.text, url)
        
        # Discard results with empty markdown content
        if not markdown or not markdown.strip():
            print(f"[ERROR] {url} - Empty content after extraction")
            return ScrapedPage(
                url=url,
                title=title,
                markdown="",
                success=False,
                error="Empty content after extraction"
            )
        
        print(f"[COMPLETE] {url}")
        return ScrapedPage(
            url=url,
            title=title,
            markdown=markdown,
            success=True
        )
        
    except httpx.TimeoutException:
        print(f"[ERROR] {url} - Timeout")
        return ScrapedPage(url=url, title=None, markdown="", success=False, error="Timeout")
    except httpx.HTTPStatusError as e:
        print(f"[ERROR] {url} - HTTP {e.response.status_code}")
        return ScrapedPage(url=url, title=None, markdown="", success=False, error=f"HTTP {e.response.status_code}")
    except Exception as e:
        print(f"[ERROR] {url} - {str(e)}")
        return ScrapedPage(url=url, title=None, markdown="", success=False, error=str(e))


async def scrape_urls(
    urls: list[str],
    timeout: float = 30.0,
    max_concurrent: int = 10,
    headers: Optional[dict] = None,
) -> list[Document]:
    """
    Scrape multiple URLs concurrently and return LangChain Documents.
    
    Args:
        urls: List of URLs to scrape
        timeout: Request timeout in seconds
        max_concurrent: Maximum concurrent requests
        headers: Optional custom headers
    
    Returns:
        List of LangChain Document objects with markdown content
    """
    default_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }
    if headers:
        default_headers.update(headers)
    
    limits = httpx.Limits(max_connections=max_concurrent)
    
    async with httpx.AsyncClient(
        headers=default_headers,
        timeout=httpx.Timeout(timeout),
        limits=limits,
    ) as client:
        tasks = [fetch_url(client, url) for url in urls]
        results = await asyncio.gather(*tasks)
    
    # Filter out failed results and convert to Documents
    successful_pages = [r for r in results if r.success]
    discarded_count = len(results) - len(successful_pages)
    if discarded_count > 0:
        print(f"\n[INFO] Discarded {discarded_count} failed result(s)")
    
    # Convert to LangChain Documents
    documents = [page.to_document() for page in successful_pages]
    return documents


async def scrape_urls_async(urls: list[str], **kwargs) -> list[Document]:
    """
    Async function to scrape URLs - for use in async contexts like uvicorn.
    
    Args:
        urls: List of URLs to scrape
        **kwargs: Additional arguments passed to scrape_urls
    
    Returns:
        List of LangChain Document objects
    """
    return await scrape_urls(urls, **kwargs)


def scrape(urls: list[str], **kwargs) -> list[Document]:
    """
    Synchronous wrapper for scraping URLs.
    
    Args:
        urls: List of URLs to scrape
        **kwargs: Additional arguments passed to scrape_urls
    
    Returns:
        List of LangChain Document objects
    """
    return asyncio.run(scrape_urls(urls, **kwargs))



