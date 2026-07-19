"""
Document Bank Metadata Service - JSON-based persistence for bank metadata.
Provides fast listing without querying ChromaDB.
"""
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from config import DOCUMENT_BANK_METADATA_PATH
from utils.logging import get_logger

log = get_logger("DOC_BANKS")


def _load_banks() -> list[dict]:
    """Load banks from JSON file."""
    if not os.path.exists(DOCUMENT_BANK_METADATA_PATH):
        return []
    try:
        with open(DOCUMENT_BANK_METADATA_PATH, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def _save_banks(banks: list[dict]) -> None:
    """Save banks to JSON file."""
    os.makedirs(os.path.dirname(DOCUMENT_BANK_METADATA_PATH), exist_ok=True)
    with open(DOCUMENT_BANK_METADATA_PATH, "w") as f:
        json.dump(banks, f, indent=2)


def list_banks() -> list[dict]:
    """Return all banks with their file metadata."""
    return _load_banks()


def create_bank(name: str) -> dict:
    """Create a new bank and return its metadata."""
    banks = _load_banks()
    now = datetime.now(timezone.utc).isoformat()
    bank = {
        "id": str(uuid.uuid4()),
        "name": name,
        "created_at": now,
        "updated_at": now,
        "files": [],
    }
    banks.append(bank)
    _save_banks(banks)
    log.info(f"Created bank '{name}' ({bank['id']})")
    return bank


def rename_bank(bank_id: str, name: str) -> Optional[dict]:
    """Rename a bank. Returns updated bank or None if not found."""
    banks = _load_banks()
    for bank in banks:
        if bank["id"] == bank_id:
            bank["name"] = name
            bank["updated_at"] = datetime.now(timezone.utc).isoformat()
            _save_banks(banks)
            log.info(f"Renamed bank {bank_id} to '{name}'")
            return bank
    return None


def add_file_to_bank(bank_id: str, file_info: dict) -> Optional[dict]:
    """Add a file record to a bank. Returns updated bank or None."""
    banks = _load_banks()
    for bank in banks:
        if bank["id"] == bank_id:
            # Remove existing entry for same filename (re-upload)
            bank["files"] = [f for f in bank["files"] if f["name"] != file_info["name"]]
            bank["files"].append(file_info)
            bank["updated_at"] = datetime.now(timezone.utc).isoformat()
            _save_banks(banks)
            log.info(f"Added file '{file_info['name']}' to bank {bank_id}")
            return bank
    return None


def remove_file_from_bank(bank_id: str, filename: str) -> Optional[dict]:
    """Remove a file record from a bank. Returns updated bank or None."""
    banks = _load_banks()
    for bank in banks:
        if bank["id"] == bank_id:
            bank["files"] = [f for f in bank["files"] if f["name"] != filename]
            bank["updated_at"] = datetime.now(timezone.utc).isoformat()
            _save_banks(banks)
            log.info(f"Removed file '{filename}' from bank {bank_id}")
            return bank
    return None


def delete_bank_metadata(bank_id: str) -> bool:
    """Delete a bank's metadata. Returns True if found and deleted."""
    banks = _load_banks()
    original_len = len(banks)
    banks = [b for b in banks if b["id"] != bank_id]
    if len(banks) < original_len:
        _save_banks(banks)
        log.info(f"Deleted bank metadata {bank_id}")
        return True
    return False


def get_bank(bank_id: str) -> Optional[dict]:
    """Get a single bank by ID. Returns None if not found."""
    banks = _load_banks()
    for bank in banks:
        if bank["id"] == bank_id:
            return bank
    return None
