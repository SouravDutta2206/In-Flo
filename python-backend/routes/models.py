"""
Models routes - handles model listing endpoints.
"""
from fastapi import APIRouter, HTTPException

from utils.schemas import ModelResponse, ModelRequest, ModelID
from utils.model_list import get_gemini_models_list, get_groq_models_list

router = APIRouter(tags=["models"])


@router.post("/api/gemini/models")
async def get_gemini_models(request: ModelRequest):
    """Get available Gemini models."""
    try:
        models = get_gemini_models_list(api_key=request.api_key)
        return ModelResponse(data=[ModelID(id=model) for model in models])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/groq/models")
async def get_groq_models(request: ModelRequest):
    """Get available Groq models."""
    try:
        models = get_groq_models_list(api_key=request.api_key)
        return ModelResponse(data=[ModelID(id=model.get('id')) for model in models])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
