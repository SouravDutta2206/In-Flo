from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional


class ModelInfo(BaseModel):
    name: str
    provider: str
    key: str

class Message(BaseModel):
    role: str   
    content: str

class FileContext(BaseModel):
    """Represents an uploaded file reference for chat context."""
    name: str
    content: Optional[str] = None  # Optional - not sent from frontend in RAG mode
    tokens: Optional[int] = None

class FileUploadResponse(BaseModel):
    """Response after uploading and processing a file."""
    name: str
    tokens: int
    chunks: int
    status: str = "uploaded"
    
class ChatRequest(BaseModel):
    conversation: List[Message]
    model: ModelInfo
    web_search: bool = False
    tavily_api_key: str = ""
    files: Optional[List[FileContext]] = None
    document_banks: Optional[List["SelectedDocumentBank"]] = None

class SelectedDocumentBank(BaseModel):
    """A document bank selected for chat context."""
    id: str
    name: Optional[str] = None

class SourcePath(BaseModel):
    path: str

class ChatResponse(BaseModel):
    response: str
    model: str
    content: str
    sources: List[SourcePath]

class ModelCapabilities(BaseModel):
    input: List[str]
    output: List[str]

class AvailableModel(BaseModel):
    name: str
    model_id: str
    provider: str
    capabilities: ModelCapabilities

class ModelsRequest(BaseModel):
    groq_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None

class ModelsResponse(BaseModel):
    data: List[AvailableModel]

class RequestState:
    def __init__(self, request_id: int, app: FastAPI):
        self.request_id = request_id
        self.app = app

    def is_disconnected(self) -> bool:
        return not hasattr(self.app.state, 'active_requests') or self.request_id not in self.app.state.active_requests