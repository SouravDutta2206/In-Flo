"""
LLM Chat API - FastAPI application entry point.
"""
import sys
sys.dont_write_bytecode = True

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from services.file_upload.vector_store import clear_database
from routes import router


app = FastAPI(
    title="LLM Chat API",
    description="API for interacting with various LLM models with streaming support",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app lifecycle - initialize and cleanup request tracking."""
    # Clear file upload database at startup for fresh state
    clear_database()
    print("[STARTUP] File upload database cleared")
    
    app.state.active_requests = set()
    print("Server started, request tracking initialized")
    yield
    app.state.active_requests.clear()
    print("Server shutdown, request tracking cleared")

app.router.lifespan_context = lifespan

# Include all routes
app.include_router(router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
