"""
PDF processing module - handles PDF text extraction and markdown formatting.
"""
import io
import re
from typing import List
from pypdf import PdfReader
from config import CHUNK_SIZE, CHUNK_OVERLAP
from utils.chunking import split_text


def clean_pdf_text(text: str) -> str:
    """
    Clean up extracted PDF text for better markdown formatting.
    - Normalizes whitespace
    - Fixes broken lines from PDF extraction
    - Preserves paragraph breaks
    """
    if not text:
        return ""
    
    # Replace multiple spaces with single space
    text = re.sub(r'[ \t]+', ' ', text)
    
    # Fix hyphenated line breaks (word-\nbreak -> wordbreak)
    text = re.sub(r'-\n', '', text)
    
    # Replace single newlines (within paragraphs) with space
    # but preserve double newlines (paragraph breaks)
    text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)
    
    # Normalize multiple newlines to double newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Clean up spaces around newlines
    text = re.sub(r' *\n *', '\n', text)
    
    # Remove leading/trailing whitespace from each line
    lines = [line.strip() for line in text.split('\n')]
    text = '\n'.join(lines)
    
    return text.strip()


def extract_pdf_text(file_content: bytes) -> str:
    """
    Extract text from PDF bytes and format as markdown.
    
    Args:
        file_content: Raw bytes of the PDF file
        
    Returns:
        Markdown-formatted text content
    """
    pdf_file = io.BytesIO(file_content)
    reader = PdfReader(pdf_file)
    markdown_parts = []
    
    for page_num, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text()
        if page_text:
            # Clean up the text
            cleaned_text = clean_pdf_text(page_text)
            if cleaned_text.strip():
                # Add page header for multi-page documents
                if len(reader.pages) > 1:
                    markdown_parts.append(f"## Page {page_num}\n\n{cleaned_text}")
                else:
                    markdown_parts.append(cleaned_text)
    
    return "\n\n---\n\n".join(markdown_parts)


def extract_pages_with_chunks(
    filename: str,
    file_content: bytes,
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP
) -> tuple[List[str], List[dict], int]:
    """
    Extract PDF text as chunks with page metadata for vector storage.
    
    Args:
        filename: Name of the PDF file
        file_content: Raw bytes of the PDF file
        chunk_size: Target size for each chunk
        chunk_overlap: Overlap between chunks
        
    Returns:
        Tuple of (chunks, metadatas, total_tokens)
        - chunks: List of text chunks
        - metadatas: List of {"filename": str, "page": int} dicts
        - total_tokens: Estimated total token count
    """
    pdf_file = io.BytesIO(file_content)
    reader = PdfReader(pdf_file)
    
    all_chunks = []
    all_metadatas = []
    total_chars = 0
    
    for page_num, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text()
        if page_text:
            cleaned_text = clean_pdf_text(page_text)
            if cleaned_text.strip():
                total_chars += len(cleaned_text)
                # Split this page's text into chunks using shared utility
                page_chunks = split_text(cleaned_text, chunk_size, chunk_overlap)
                for chunk in page_chunks:
                    all_chunks.append(chunk)
                    all_metadatas.append({
                        "filename": filename,
                        "page": page_num
                    })
    
    # Estimate tokens (~4 chars per token)
    total_tokens = total_chars // 4
    
    return all_chunks, all_metadatas, total_tokens
