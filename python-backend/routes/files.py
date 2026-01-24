"""
Files routes - handles file upload and management endpoints.
"""
import sys
sys.dont_write_bytecode = True

from fastapi import APIRouter, HTTPException, UploadFile, File

from utils.schemas import FileUploadResponse
from services.file_upload.pdf_processing import extract_pages_with_chunks
from services.file_upload.vector_store import add_documents, delete_documents, clear_database

router = APIRouter(prefix="/api/files", tags=["files"])


@router.post("/process")
async def process_file_endpoint(file: UploadFile = File(...)):
    """
    Process an uploaded PDF file, chunk it, and store in ChromaDB.
    
    Returns:
        FileUploadResponse with name, token count, chunk count, and status
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        content = await file.read()
        
        # Extract chunks with page metadata
        chunks, metadatas, tokens = extract_pages_with_chunks(file.filename, content)
        
        if not chunks:
            raise ValueError("Could not extract text from PDF")
        
        # Delete any existing chunks for this file (re-upload case)
        delete_documents([file.filename])
        
        # Add to ChromaDB
        chunk_count = add_documents(chunks, metadatas, file.filename)
        
        return FileUploadResponse(
            name=file.filename,
            tokens=tokens,
            chunks=chunk_count,
            status="uploaded"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


@router.delete("/clear")
async def clear_files_endpoint():
    """
    Clear the entire file upload database.
    Called when user clicks "clear all" or wants to start fresh.
    
    Returns:
        Success status
    """
    try:
        success = clear_database()
        if success:
            return {"status": "cleared", "message": "All files cleared successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to clear database")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing files: {str(e)}")
