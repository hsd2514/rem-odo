from __future__ import annotations

import os
import uuid
from pathlib import Path

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"


def ensure_upload_dir() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def save_upload(file_bytes: bytes, original_name: str) -> str:
    ensure_upload_dir()
    ext = os.path.splitext(original_name)[1] or ".jpg"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / unique_name
    dest.write_bytes(file_bytes)
    return str(dest)
