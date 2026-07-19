"""
Document Banks routes - handles CRUD for document banks and file uploads into banks.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional

from services.document_banks.metadata import (
    list_banks, create_bank, rename_bank, get_bank,
    add_file_to_bank, remove_file_from_bank, delete_bank_metadata,
)
from services.document_banks.vector_store import (
    add_bank_documents, delete_bank_file, delete_bank,
)
from services.file_upload.pdf_processing import extract_pages_with_chunks

router = APIRouter(prefix="/api/document-banks", tags=["document-banks"])


class CreateBankRequest(BaseModel):
    name: str

class RenameBankRequest(BaseModel):
    name: str


@router.get("")
async def list_banks_endpoint():
    """Return all banks and file metadata."""
    return list_banks()


@router.post("")
async def create_bank_endpoint(body: CreateBankRequest):
    """Create a new document bank."""
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=400, detail="Bank name is required")
    return create_bank(body.name.strip())


@router.patch("/{bank_id}")
async def rename_bank_endpoint(bank_id: str, body: RenameBankRequest):
    """Rename a document bank."""
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=400, detail="Bank name is required")
    result = rename_bank(bank_id, body.name.strip())
    if result is None:
        raise HTTPException(status_code=404, detail="Bank not found")
    return result


@router.delete("/{bank_id}")
async def delete_bank_endpoint(bank_id: str):
    """Delete a document bank and its Chroma collection."""
    delete_bank(bank_id)
    deleted = delete_bank_metadata(bank_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Bank not found")
    return {"status": "deleted", "bank_id": bank_id}


@router.post("/{bank_id}/files")
async def upload_file_to_bank(bank_id: str, file: UploadFile = File(...)):
    """Upload a PDF into a document bank."""
    # Verify bank exists
    bank = get_bank(bank_id)
    if bank is None:
        raise HTTPException(status_code=404, detail="Bank not found")

    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    try:
        content = await file.read()

        # Reuse existing PDF extraction
        chunks, metadatas, tokens = extract_pages_with_chunks(file.filename, content)

        if not chunks:
            raise ValueError("Could not extract text from PDF")

        # Delete existing chunks for this file (re-upload case)
        delete_bank_file(bank_id, file.filename)

        # Add to persistent bank collection
        chunk_count = add_bank_documents(
            bank_id=bank_id,
            bank_name=bank["name"],
            filename=file.filename,
            chunks=chunks,
            metadatas=metadatas,
        )

        # Update metadata JSON
        file_info = {
            "name": file.filename,
            "tokens": tokens,
            "chunks": chunk_count,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        }
        updated_bank = add_file_to_bank(bank_id, file_info)

        return {
            "bank": updated_bank,
            "file": file_info,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


@router.delete("/{bank_id}/files/{filename:path}")
async def delete_file_from_bank(bank_id: str, filename: str):
    """Remove a file from a document bank."""
    bank = get_bank(bank_id)
    if bank is None:
        raise HTTPException(status_code=404, detail="Bank not found")

    delete_bank_file(bank_id, filename)
    updated_bank = remove_file_from_bank(bank_id, filename)

    return {"status": "deleted", "bank": updated_bank}
