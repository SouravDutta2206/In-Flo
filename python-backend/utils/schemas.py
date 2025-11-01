import sys
sys.dont_write_bytecode = True

from fastapi import FastAPI
from pydantic import BaseModel
from typing import List


class ModelInfo(BaseModel):
    name: str
    provider: str
    key: str

class Message(BaseModel):
    role: str   
    content: str
    
class ChatRequest(BaseModel):
    conversation: List[Message]
    model: ModelInfo
    web_search: bool = False
    tavily_api_key: str = ""

class SourcePath(BaseModel):
    path: str

class ChatResponse(BaseModel):
    response: str
    model: str
    content: str
    sources: List[SourcePath]

class ModelID(BaseModel):
    id : str

class ModelRequest(BaseModel):
    api_key: str

class ModelResponse(BaseModel):
    data: List[ModelID]

class RequestState:
    def __init__(self, request_id: int, app: FastAPI):
        self.request_id = request_id
        self.app = app

    def is_disconnected(self) -> bool:
        return not hasattr(self.app.state, 'active_requests') or self.request_id not in self.app.state.active_requests