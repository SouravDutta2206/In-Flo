"""
Routes package - API endpoint handlers.
"""
from fastapi import APIRouter

# Import routers from submodules
from routes.chat import router as chat_router
from routes.files import router as files_router
from routes.models import router as models_router

# Main router that aggregates all sub-routers
router = APIRouter()
router.include_router(chat_router)
router.include_router(files_router)
router.include_router(models_router)
