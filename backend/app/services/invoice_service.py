"""Render a booking as a GST tax-invoice PDF (A4)."""

from datetime import datetime
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.booking import Booking
from app.models.hotel_settings import HotelSettings

_ONES = (
    "Zero One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen Fourteen "
    "Fifteen Sixteen Seventeen Eighteen Nineteen"
).split()
_TENS = "_ _ Twenty Thirty Forty Fifty Sixty Seventy Eighty Ninety".split()


def _below_thousand(n: int) -> str:
    parts = []
    if n >= 100:
        parts.append(f"{_ONES[n // 100]} Hundred")
        n %= 100
    if n >= 20:
        parts.append(_TENS[n // 10] + (f"-{_ONES[n % 10]}" if n % 10 else ""))
    elif n > 0:
        parts.append(_ONES[n])
    return " ".join(parts)


def amount_in_words(value: float) -> str:
    """Indian-system words, e.g. 1236 -> 'One Thousand Two Hundred Thirty-Six Only'."""
    rupees, paise = divmod(round(value * 100), 100)
    if rupees == 0 and paise == 0:
        return "Zero Only"
    parts = []
    for size, name in ((10_000_000, "Crore"), (100_000, "Lakh"), (1000, "Thousand")):
        if rupees >= size:
            parts.append(f"{_below_thousand(rupees // size)} {name}")
            rupees %= size
    if rupees:
        parts.append(_below_thousand(rupees))
    words = " ".join(parts) or "Zero"
    if paise:
        words += f" and {_below_thousand(paise)} Paise"
    return words + " Only"


def _money(v: float) -> str:
    return f"{v:,.2f}"


def _p(text: str, font: str = "Helvetica", size: float = 9, leading: float | None = None, **kw) -> Paragraph:
    style = ParagraphStyle("c", fontName=font, fontSize=size, leading=leading or size * 1.3, **kw)
    return Paragraph(text, style)


def _dt(d, hhmm: str) -> datetime:
    h, m = hhmm.split(":")
    return datetime(d.year, d.month, d.day, int(h), int(m))


def _clock(d: datetime) -> str:
    return f"{d:%d-%b-%y} {d.hour % 12 or 12}:{d:%M}:00{d:%p}"


def build_invoice_pdf(booking: Booking, hotel: HotelSettings) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title=f"Invoice {booking.id} - {booking.guest_name}",
    )
    width = A4[0] - 28 * mm
    e = escape
    story = []

    ctr = dict(alignment=TA_CENTER)
    story.append(_p(e(hotel.hotel_name.upper()), font="Helvetica-Bold", size=16, leading=19, **ctr))
    if hotel.tagline:
        story.append(_p(e(hotel.tagline), font="Helvetica-Bold", size=10, **ctr))
    story.append(_p(e(hotel.address), **ctr))
    story.append(_p(f"<b>Mobile : {e(hotel.mobile_numbers)}</b>", **ctr))
    story.append(Spacer(1, 4 * mm))
    story.append(_p("TAX INVOICE", font="Helvetica-Bold", size=12, leading=15, **ctr))
    story.append(Spacer(1, 2 * mm))

    arrival = _dt(booking.check_in, booking.check_in_time)
    departure = _dt(booking.check_out, booking.check_out_time)

    def label(t: str) -> Paragraph:
        return _p(t, textColor=colors.HexColor("#444444"))

    def kv_table(rows, first_w, second_w):
        t = Table(rows, colWidths=[first_w, second_w])
        t.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 3),
                    ("TOPPADDING", (0, 0), (-1, -1), 1),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                ]
            )
        )
        return t

    lw, rw = width * 0.55, width * 0.45
    lab = 31 * mm
    addr = e(booking.address or "-").replace("\n", "<br/>")
    left = kv_table(
        [
            [label("Guest Name :"), _p(f"<b>{e(booking.guest_name.upper())}</b>")],
            [label("Company Name :"), _p(f"<b>{e((booking.company_name or '').upper())}</b>")],
            [label("Guest GST No. :"), _p(f"<b>{e((booking.guest_gst_number or '').upper())}</b>")],
            [label("Address :"), _p(addr)],
        ],
        lab,
        lw - lab - 2,
    )
    right = kv_table(
        [
            [label("Bill Date :"), _p(f"<b>{departure:%d/%m/%Y}</b>")],
            [label("Bill No :"), _p(f"<b>{booking.id}</b>")],
            [label("Register No :"), _p(f"<b>{booking.id}</b>")],
            [label("Room No :"), _p(f"<b>{e(booking.room.room_number)}</b>")],
            [label("No. Person :"), _p(f"<b>{booking.guest_count}</b>")],
        ],
        lab,
        rw - lab - 2,
    )
    per_night_discount = booking.discount / booking.nights if booking.nights else 0.0
    tariff = kv_table(
        [
            [label("Room Tarrif :"), _p(f"<b>{_money(booking.effective_rate)}</b>")],
            [label("Discount Amt:"), _p(f"<b>{_money(booking.discount)}</b>")],
            [label("Discount Tarrif :"), _p(f"<b>{_money(booking.effective_rate - per_night_discount)}</b>")],
        ],
        lab,
        lw - lab - 2,
    )
    dates = kv_table(
        [
            [label("Arrival Date :"), _p(f"<b>{_clock(arrival)}</b>")],
            [label("Departure Date :"), _p(f"<b>{_clock(departure)}</b>")],
        ],
        lab + 4 * mm,
        rw - lab - 4 * mm - 2,
    )
    header = Table([[left, right], [tariff, dates]], colWidths=[lw, rw], rowHeights=[33 * mm, 19 * mm])
    header.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.8, colors.black),
                ("LINEAFTER", (0, 0), (0, 1), 0.8, colors.black),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(header)

    # --- Room charge table ---------------------------------------------------------------
    def hd(t: str) -> Paragraph:
        return _p(t, font="Helvetica-Bold", size=8, leading=10, alignment=TA_CENTER)

    def cell(t: str) -> Paragraph:
        return _p(t, size=8.5, alignment=TA_CENTER)

    gst_total = booking.cgst_amount + booking.sgst_amount
    room_rows = [
        [
            hd("Room<br/>No"),
            hd("Arrival Date Time &amp;<br/>Dept. Date Time"),
            hd("Per"),
            hd("Rate"),
            hd("Days"),
            hd("Amount"),
            hd("Disc<br/>Amt"),
            hd("Taxable<br/>Amount"),
            hd("GST<br/>C GST / S GST"),
            hd("Total<br/>Amount"),
        ],
        [
            cell(e(booking.room.room_number)),
            cell(f"{arrival:%d/%m/%Y %H:%M}<br/>{departure:%d/%m/%Y %H:%M}"),
            cell(str(booking.guest_count)),
            cell(_money(booking.effective_rate)),
            cell(str(booking.nights)),
            cell(_money(booking.amount)),
            cell(_money(booking.discount)),
            cell(_money(booking.taxable)),
            cell(f"<b>{_money(gst_total)}</b><br/>{_money(booking.cgst_amount)} / {_money(booking.sgst_amount)}"),
            cell(f"<b>{_money(booking.total)}</b>"),
        ],
    ]
    cw = [15, 33, 10, 17, 13, 19, 14, 20, 27, 19]
    scale = width / sum(cw)
    room_tbl = Table(room_rows, colWidths=[c * scale for c in cw])
    room_tbl.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.6, colors.black),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(room_tbl)

    bill = Table(
        [
            [
                _p("<b>Bill Amount :</b>", alignment=TA_RIGHT),
                _p(f"<b>{_money(booking.total)}</b>", alignment=TA_RIGHT),
            ]
        ],
        colWidths=[width * 0.8, width * 0.2],
    )
    bill.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.6, colors.black)]))
    story.append(bill)

    # --- Services (kept for parity with the paper bill; none are tracked yet) ------------
    def sv(t: str, **k) -> Paragraph:
        return _p(t, size=8.5, **k)

    svc_rows = [
        [sv("<b>SERVICES</b>"), sv("<b>Amount</b>"), sv("<b>C GST</b>"), sv("<b>S GST</b>"),
         sv("<b>Total Services Amt</b>", alignment=TA_RIGHT)]
    ]
    for name in ("Food &amp; Beverages", "Laundry", "Miscellaneous Exp.", "Taxi", "Extra Person :"):
        svc_rows.append([sv(name), sv("0.00"), sv("0.00"), sv("0.00"), sv("0.00", alignment=TA_RIGHT)])
    svc_rows.append(["", "", "", sv("<b>Total Services Amount :</b>", alignment=TA_RIGHT),
                     sv("<b>0.00</b>", alignment=TA_RIGHT)])
    svc = Table(svc_rows, colWidths=[width * f for f in (0.30, 0.15, 0.15, 0.22, 0.18)])
    svc.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.6, colors.black),
                ("LINEBELOW", (0, 0), (-1, 0), 0.6, colors.black),
                ("LINEABOVE", (0, -1), (-1, -1), 0.6, colors.black),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    story.append(svc)
    story.append(Spacer(1, 4 * mm))

    # --- Totals --------------------------------------------------------------------------
    left_txt = [
        _p(f"GST IN : {e(hotel.gst_number)}", font="Helvetica-Bold"),
        _p(f"HSN / SAC CODE : {e(hotel.hsn_code)}", font="Helvetica-Bold"),
        _p(f"Rs. {amount_in_words(booking.total)}", font="Helvetica-Bold"),
    ]
    inner_w = width * 0.4 - 16  # leave room for the outer cell's padding so nothing touches the border
    right_tbl = Table(
        [
            [sv("<b>Total Amount :</b>", alignment=TA_RIGHT), sv(_money(booking.total), alignment=TA_RIGHT)],
            [sv("Less :- Advance", alignment=TA_RIGHT), sv("0.00", alignment=TA_RIGHT)],
            [sv("<b>Amount Receivable</b>", alignment=TA_RIGHT),
             sv(f"<b>{_money(booking.total)}</b>", alignment=TA_RIGHT)],
        ],
        colWidths=[inner_w * 0.62, inner_w * 0.38],
    )
    right_tbl.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 1), (-1, 1), 0.6, colors.black),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    totals = Table([[left_txt, right_tbl]], colWidths=[width * 0.6, width * 0.4])
    totals.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.8, colors.black),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(totals)
    story.append(Spacer(1, 18 * mm))

    # --- Footer --------------------------------------------------------------------------
    story.append(
        _p(
            "I agree that I am responsible for the full payment to this bill in the event it is not "
            "paid by the company, organisation or person(s) indicated by me.",
            size=8,
        )
    )
    story.append(Spacer(1, 3 * mm))
    jur = f"Subject to {e(hotel.jurisdiction)} Jurisdiction" if hotel.jurisdiction else ""
    pay = _p(f"<i>Payment Type :</i>  <i>{e(booking.payment_method)}</i>", size=9)
    bw, gap = width * 0.31, width * 0.035
    footer = Table(
        [
            [_p(f"<b>{jur}</b>", size=8), "", "", "", _p(f"<b>{e(hotel.hotel_name.upper())}</b>", size=8, alignment=TA_RIGHT)],
            ["", "", pay, "", ""],
            [_p("Guest Signature", size=9, alignment=TA_CENTER), "", "",
             "", _p("Manager / Receptionist", size=9, alignment=TA_CENTER)],
        ],
        colWidths=[bw, gap, bw, gap, bw],
        rowHeights=[None, 11 * mm, None],
    )
    footer.setStyle(
        TableStyle(
            [
                ("SPAN", (0, 0), (2, 0)),
                ("BOX", (0, 1), (0, 1), 0.8, colors.black),
                ("BOX", (2, 1), (2, 1), 0.8, colors.black),
                ("BOX", (4, 1), (4, 1), 0.8, colors.black),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("LEFTPADDING", (2, 1), (2, 1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(footer)

    doc.build(story)
    return buf.getvalue()
