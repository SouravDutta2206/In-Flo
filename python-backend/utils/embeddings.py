"""
Shared embedding model singleton for consistent embeddings across modules.
This ensures the SentenceTransformer model is loaded only once.
"""
import sys
sys.dont_write_bytecode = True

import torch
from typing import Optional
from sentence_transformers import SentenceTransformer
from config import EMBEDDING_MODEL

# Singleton model instance
_model: Optional[SentenceTransformer] = None


def get_embedding_model() -> SentenceTransformer:
    """
    Get or create the shared embedding model.
    
    This function ensures the model is only loaded once and reused
    across all modules that need embeddings.
    
    Returns:
        SentenceTransformer model instance
    """
    global _model
    if _model is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        _model = SentenceTransformer(EMBEDDING_MODEL, device=device)
        print(f"[EMBEDDINGS] Loaded model '{EMBEDDING_MODEL}' on {device}")
    return _model


def get_device() -> str:
    """Get the device being used for embeddings."""
    return "cuda" if torch.cuda.is_available() else "cpu"
