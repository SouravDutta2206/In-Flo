"""
PDF processing module - handles PDF text extraction and markdown formatting.
"""
import sys
sys.dont_write_bytecode = True

import io
import re
from typing import List, Optional
from pypdf import PdfReader
from utils.schemas import FileContext


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
    chunk_size: int = 800,
    chunk_overlap: int = 80
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
    from langchain_classic.text_splitter import RecursiveCharacterTextSplitter
    
    pdf_file = io.BytesIO(file_content)
    reader = PdfReader(pdf_file)
    
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ".", "?", "!", " ", ""]
    )
    
    all_chunks = []
    all_metadatas = []
    total_chars = 0
    
    for page_num, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text()
        if page_text:
            cleaned_text = clean_pdf_text(page_text)
            if cleaned_text.strip():
                total_chars += len(cleaned_text)
                # Split this page's text into chunks
                page_chunks = splitter.split_text(cleaned_text)
                for chunk in page_chunks:
                    all_chunks.append(chunk)
                    all_metadatas.append({
                        "filename": filename,
                        "page": page_num
                    })
    
    # Estimate tokens (~4 chars per token)
    total_tokens = total_chars // 4
    
    return all_chunks, all_metadatas, total_tokens


def build_file_context(files: Optional[List]) -> str:
    """Build context string from uploaded files."""
    if not files:
        return ""
    
    context_parts = ["Documents provided:"]
    for f in files:
        context_parts.append(f"---\n[{f.name}]:\n{f.content}\n---")
    
    return "\n".join(context_parts)


def process_pdf(filename: str, file_content: bytes) -> FileContext:
    """
    Process PDF file and return FileContext with extracted markdown content.
    
    Args:
        filename: Name of the PDF file
        file_content: Raw bytes of the PDF file
        
    Returns:
        FileContext with name, markdown content, and token count
        
    Raises:
        ValueError: If PDF is empty or cannot be processed
    """
    markdown_content = extract_pdf_text(file_content)
    
    if not markdown_content.strip():
        raise ValueError("Could not extract text from PDF")
    
    # Estimate token count (rough heuristic: ~4 chars per token)
    token_count = len(markdown_content) // 4
    
    return FileContext(
        name=filename,
        content=markdown_content,
        tokens=token_count
    )
