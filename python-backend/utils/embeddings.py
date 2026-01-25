"""
Shared embedding model singleton for consistent embeddings across modules.
Supports both SentenceTransformers and FastEmbed providers.
"""
import sys
sys.dont_write_bytecode = True

import numpy as np
import torch
from typing import Optional, Protocol, Union
from config import EMBEDDING_MODEL
from fastembed import TextEmbedding

class EmbeddingModel(Protocol):
    """Protocol for embedding models - both providers implement this interface."""
    
    def encode(self, texts: list[str], **kwargs) -> np.ndarray:
        """Encode texts to embeddings as numpy array."""
        ...

class FastEmbedModel:
    """Wrapper for FastEmbed to match our interface."""
    
    def __init__(self, model_name: str = EMBEDDING_MODEL):
        providers = ["CUDAExecutionProvider"] if torch.cuda.is_available() else ["CPUExecutionProvider"]
        self.model = TextEmbedding(model_name=model_name, providers=providers)
    
    def encode(self, texts: list[str], **kwargs) -> np.ndarray:
        """Encode texts using FastEmbed."""
        embeddings = list(self.model.embed(texts))
        return np.array(embeddings, dtype=np.float32)
