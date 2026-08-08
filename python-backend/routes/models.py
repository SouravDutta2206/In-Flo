"""
Models routes - single aggregate endpoint for all providers.
"""
from fastapi import APIRouter, HTTPException

from utils.schemas import ModelsRequest, ModelsResponse, AvailableModel, ModelCapabilities
from utils.fetch_models import get_models_list

router = APIRouter(tags=["models"])


@router.post("/api/models", response_model=ModelsResponse)
async def get_models(request: ModelsRequest):
    """Get available models from all providers in one call."""
    try:
        raw = await get_models_list(
            groq_api_key=request.groq_api_key,
            gemini_api_key=request.gemini_api_key,
        )

        models = [
            AvailableModel(
                name=m["name"],
                model_id=m["model_id"],
                provider=m["provider"],
                capabilities=ModelCapabilities(**m["capabilities"]),
            )
            for m in raw
        ]

        return ModelsResponse(data=models)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
