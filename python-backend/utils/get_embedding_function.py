from langchain_ollama import OllamaEmbeddings
from langchain_community.embeddings import HuggingFaceInferenceAPIEmbeddings
from langchain_huggingface import HuggingFaceEmbeddings
import torch
import os

def hf_embeddings(model_name, token):    

    embeddings = HuggingFaceInferenceAPIEmbeddings(model_name=model_name, api_key=token)
    return embeddings

def ollama_embeddings(model_name):

    embeddings = OllamaEmbeddings(model=model_name)
    return embeddings

def hf_local_embeddings(model_name):

    if torch.cuda.is_available():
        device = "cuda"
    else:
        device = "cpu"

    model_kwargs = {'device': device}
    encode_kwargs = {'normalize_embeddings': False}

    embeddings = HuggingFaceEmbeddings(
        model_name=model_name,
        model_kwargs=model_kwargs,
        encode_kwargs=encode_kwargs,
        cache_folder = os.path.join(os.getcwd(), "hf_cache"),
    )

    return embeddings




