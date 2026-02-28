"""
Centralized configuration for the Python backend.
All shared constants are defined here to avoid duplication.
"""
# Embedding model configuration
# Provider: "sentence-transformers" or "fastembed"
import os

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# Text chunking configuration
CHUNK_SIZE = 800
CHUNK_OVERLAP = 80

# Search/retrieval configuration
TOP_K_RESULTS = 5

# ChromaDB configuration
CHROMA_DB_PATH = "./chroma_db/file_upload"
CHROMA_COLLECTION = "documents"

# Query expansion configuration
ENABLE_QUERY_EXPANSION = True  # Master toggle for query expansion
QUERY_EXPANSION_MAX_HISTORY = 5  # Number of previous messages to consider

# Logging configuration
# Options: "DEBUG", "INFO", "WARNING", "ERROR"
LOG_LEVEL = "DEBUG"  # Set to "DEBUG" to see all debug messages
