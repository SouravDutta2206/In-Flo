"""
Text chunking utilities - shared text splitting functions.
"""
from langchain_classic.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from config import CHUNK_SIZE, CHUNK_OVERLAP


def get_text_splitter(
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP
) -> RecursiveCharacterTextSplitter:
    """
    Get a configured text splitter instance.
    
    Args:
        chunk_size: Target size for each chunk
        chunk_overlap: Overlap between chunks
        
    Returns:
        Configured RecursiveCharacterTextSplitter
    """
    return RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ".", "?", "!", " ", ""]
    )


def split_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP
) -> list[str]:
    """
    Split text into chunks using the standard splitter.
    
    Args:
        text: Text to split
        chunk_size: Target size for each chunk
        chunk_overlap: Overlap between chunks
        
    Returns:
        List of text chunks
    """
    splitter = get_text_splitter(chunk_size, chunk_overlap)
    return splitter.split_text(text)


def split_documents(
    docs: list[Document],
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP
) -> list[Document]:
    """
    Split documents into smaller chunks.
    
    Args:
        docs: List of LangChain Document objects
        chunk_size: Target size for each chunk
        chunk_overlap: Overlap between chunks
        
    Returns:
        List of chunked Document objects
    """
    if not docs:
        return []
    
    splitter = get_text_splitter(chunk_size, chunk_overlap)
    return splitter.split_documents(docs)
