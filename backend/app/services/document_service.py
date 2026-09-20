"""Store and serve ID / supporting documents (images or PDFs) attached to bookings."""

import shutil
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.booking_document import BookingDocument
from app.services.booking_service import get_booking

ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
}


def _booking_dir(booking_id: int) -> Path:
    return Path(settings.UPLOAD_DIR) / str(booking_id)


def _path_for(doc: BookingDocument) -> Path:
    return _booking_dir(doc.booking_id) / doc.stored_name


def add_documents(db: Session, booking_id: int, files: list[UploadFile]) -> list[BookingDocument]:
    booking = get_booking(db, booking_id)
    if len(booking.documents) + len(files) > settings.MAX_DOCUMENTS_PER_BOOKING:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"At most {settings.MAX_DOCUMENTS_PER_BOOKING} documents per booking",
        )

    # Validate everything first so a bad file doesn't leave a half-saved batch.
    payloads: list[tuple[UploadFile, bytes]] = []
    for f in files:
        if f.content_type not in ALLOWED_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"'{f.filename}': only images (JPG, PNG, WebP, GIF) and PDFs are allowed",
            )
        data = f.file.read(settings.MAX_DOCUMENT_BYTES + 1)
        if len(data) > settings.MAX_DOCUMENT_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"'{f.filename}' is larger than {settings.MAX_DOCUMENT_BYTES // (1024 * 1024)} MB",
            )
        if not data:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"'{f.filename}' is empty"
            )
        payloads.append((f, data))

    folder = _booking_dir(booking_id)
    folder.mkdir(parents=True, exist_ok=True)
    created: list[BookingDocument] = []
    for f, data in payloads:
        stored = uuid.uuid4().hex + ALLOWED_TYPES[f.content_type]
        (folder / stored).write_bytes(data)
        doc = BookingDocument(
            booking_id=booking_id,
            filename=(f.filename or "document")[:255],
            stored_name=stored,
            content_type=f.content_type,
            size=len(data),
        )
        db.add(doc)
        created.append(doc)
    db.commit()
    return created


def get_document(db: Session, booking_id: int, doc_id: int) -> BookingDocument:
    doc = (
        db.query(BookingDocument)
        .filter(BookingDocument.id == doc_id, BookingDocument.booking_id == booking_id)
        .first()
    )
    if doc is None or not _path_for(doc).exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


def document_path(doc: BookingDocument) -> Path:
    return _path_for(doc)


def delete_document(db: Session, booking_id: int, doc_id: int) -> None:
    doc = (
        db.query(BookingDocument)
        .filter(BookingDocument.id == doc_id, BookingDocument.booking_id == booking_id)
        .first()
    )
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    _path_for(doc).unlink(missing_ok=True)
    db.delete(doc)
    db.commit()


def remove_booking_files(booking_id: int) -> None:
    """Delete a booking's upload folder (used when the booking itself is deleted)."""
    shutil.rmtree(_booking_dir(booking_id), ignore_errors=True)
