from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.database.session import get_db
from app.models.enums import BookingStatus
from app.schemas.booking import BookingCreate, BookingOut, BookingUpdate
from app.schemas.booking import CheckoutRequest, DocumentOut
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


def _invoice_response(db: Session, booking_id: int, *, print_it: bool) -> Response:
    booking = booking_service.get_booking(db, booking_id)
    if booking.status != BookingStatus.checked_out or booking.check_out is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The invoice is available once the guest has checked out",
        )
    hotel = settings_service.get_settings(db)
    pdf = invoice_service.build_invoice_pdf(booking, hotel)
    if print_it:
        booking_service.mark_invoice_printed(db, booking)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="invoice-{booking.id}.pdf"'},
    )


@router.get("/{booking_id}/invoice")
def view_invoice(booking_id: int, db: Session = Depends(get_db)):
    """Tax invoice as a PDF, for viewing. Does not lock the bill."""
    return _invoice_response(db, booking_id, print_it=False)


@router.post("/{booking_id}/invoice/print")
def print_invoice(booking_id: int, db: Session = Depends(get_db)):
    """Tax invoice as a PDF, for printing. From now on the bill can't be deleted."""
    return _invoice_response(db, booking_id, print_it=True)


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(payload: BookingCreate, db: Session = Depends(get_db)):
    return booking_service.create_booking(db, payload)


@router.post("/{booking_id}/checkout", response_model=BookingOut)
def checkout_booking(booking_id: int, payload: CheckoutRequest, db: Session = Depends(get_db)):
    """Record the departure date/time and mark the booking checked out."""
    return booking_service.checkout_booking(db, booking_id, payload)


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
