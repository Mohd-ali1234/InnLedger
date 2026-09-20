from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.database.session import get_db
from app.schemas.booking import BookingCreate, BookingOut, BookingUpdate
from app.schemas.booking import DocumentOut
from app.services import booking_service, document_service, invoice_service, settings_service

router = APIRouter(
    prefix="/bookings", tags=["bookings"], dependencies=[Depends(get_current_admin)]
)


@router.get("", response_model=list[BookingOut])
def list_bookings(db: Session = Depends(get_db)):
    return booking_service.list_bookings(db)


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: int, db: Session = Depends(get_db)):
    return booking_service.get_booking(db, booking_id)


@router.get("/{booking_id}/invoice")
def booking_invoice(booking_id: int, db: Session = Depends(get_db)):
    """Tax invoice for a booking as a PDF."""
    booking = booking_service.get_booking(db, booking_id)
    hotel = settings_service.get_settings(db)
    pdf = invoice_service.build_invoice_pdf(booking, hotel)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="invoice-{booking.id}.pdf"'},
    )


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(payload: BookingCreate, db: Session = Depends(get_db)):
    return booking_service.create_booking(db, payload)


@router.put("/{booking_id}", response_model=BookingOut)
def update_booking(booking_id: int, payload: BookingUpdate, db: Session = Depends(get_db)):
    return booking_service.update_booking(db, booking_id, payload)


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking(booking_id: int, db: Session = Depends(get_db)):
    booking_service.delete_booking(db, booking_id)
    document_service.remove_booking_files(booking_id)


@router.post(
    "/{booking_id}/documents", response_model=list[DocumentOut], status_code=status.HTTP_201_CREATED
)
def upload_documents(
    booking_id: int, files: list[UploadFile] = File(...), db: Session = Depends(get_db)
):
    """Attach one or more ID documents (images or PDFs) to a booking."""
    return document_service.add_documents(db, booking_id, files)


@router.get("/{booking_id}/documents/{doc_id}")
def download_document(booking_id: int, doc_id: int, db: Session = Depends(get_db)):
    doc = document_service.get_document(db, booking_id, doc_id)
    return FileResponse(
        document_service.document_path(doc),
        media_type=doc.content_type,
        headers={"Content-Disposition": f'inline; filename="{doc.filename}"'},
    )


@router.delete("/{booking_id}/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(booking_id: int, doc_id: int, db: Session = Depends(get_db)):
    document_service.delete_document(db, booking_id, doc_id)
