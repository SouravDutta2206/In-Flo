"""
Centralized configuration for the Python backend.
All shared constants are defined here to avoid duplication.
"""
import sys
sys.dont_write_bytecode = True

# Embedding model configuration
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# Text chunking configuration
CHUNK_SIZE = 800
CHUNK_OVERLAP = 80

# Search/retrieval configuration
TOP_K_RESULTS = 5

# ChromaDB configuration
CHROMA_DB_PATH = "./chroma_db/file_upload"
CHROMA_COLLECTION = "documents"
