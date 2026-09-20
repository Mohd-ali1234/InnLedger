# RoomManager — Room Management System (MVP)

A clean, modern room & booking management dashboard. FastAPI + SQLite backend,
React + Vite + TypeScript frontend with a premium SaaS UI.

![Stack](https://img.shields.io/badge/FastAPI-009688) ![Stack](https://img.shields.io/badge/React-61DAFB) ![Stack](https://img.shields.io/badge/TypeScript-3178C6) ![Stack](https://img.shields.io/badge/TailwindCSS-06B6D4)

---

## Features

- **Dashboard** — summary cards (rooms, bookings, today's check-ins/outs), room-status
  overview, and the five most recent bookings.
- **Rooms** — responsive card grid with search (number/name), status & type filters,
  and full create / edit / delete.
- **Bookings** — a polished table with status tabs, search, and create / edit / view /
  cancel / delete. Only bookable rooms are offered, double-bookings are rejected, and
  checking a guest in/out automatically flips the room between *Occupied* and *Available*.
- **ID documents** — optionally attach several IDs (images or PDFs, 10 MB each) to a booking.
- **Invoices** — one-click GST tax-invoice PDF per booking, with discount, CGST/SGST, and
  hotel details configured on the Settings page.
- **Auth** — JWT login (single seeded admin, no registration).
- **UX** — loading skeletons, toast notifications, confirm-before-delete dialogs, empty
  states, inline form validation, keyboard-friendly forms, and responsive layouts.

---

## Desktop app (InnLedger) & releases

The project ships as a Windows desktop app: Electron wraps the React UI and a bundled
copy of the FastAPI server. Data (database + uploaded IDs) lives in
`%APPDATA%\InnLedger`, so updating the app never touches it.
Default login: `admin` / `admin123`.

**Install:** download `InnLedger-Setup-<version>.exe` from the
[Releases](../../releases) page. Windows may show a SmartScreen warning because the
installer is not code-signed — choose *More info → Run anyway*.

**Ship an update:** commit your changes, then run

```powershell
.\scriptselease.ps1 1.0.1
```

This bumps the version, tags `v1.0.1` and pushes. GitHub Actions
(`.github/workflows/release.yml`) builds the installer and publishes it as a new release.
Installed apps check GitHub on start-up (and every 4 hours) and show an
**"Update available"** banner with *Download update* → *Restart & update*.
Settings → *Check for updates* also works.

**Run the desktop shell from source:**

```powershell
cd frontend; npm install; npm run build
cd ..\desktop; npm install; npm start     # needs backend\.venv (see below)
```

---

## Tech Stack

| Layer     | Technologies |
|-----------|--------------|
| Frontend  | React, Vite, TypeScript, React Router, TanStack Query, Axios, Tailwind CSS, shadcn-style components, Lucide icons |
| Backend   | FastAPI, SQLAlchemy 2, Pydantic v2, SQLite, Alembic |
| Auth      | JWT (python-jose), bcrypt password hashing |

---

## Project Structure

```
rooms-booking/
├── backend/
│   ├── app/
│   │   ├── api/          # dependencies (auth guard)
│   │   ├── core/         # config + security (JWT, hashing)
│   │   ├── database/     # engine + session + Base
│   │   ├── models/       # SQLAlchemy models (Room, Booking, Admin)
│   │   ├── schemas/      # Pydantic request/response models
│   │   ├── services/     # business logic (rooms, bookings, dashboard, auth)
│   │   ├── routers/      # API route handlers
│   │   ├── seed.py       # seed admin + 15 rooms + 10 bookings
│   │   └── main.py       # app entrypoint
│   ├── alembic/          # migrations
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── components/   # UI primitives + feature components
│       ├── pages/        # Login, Dashboard, Rooms, Bookings
│       ├── layouts/      # DashboardLayout (sidebar + navbar)
│       ├── hooks/        # useAuth + TanStack Query hooks
│       ├── services/     # axios client + API services
│       ├── types/        # shared TypeScript types
│       └── utils/        # helpers, constants, cn()
│
└── README.md
```

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+

### 1. Backend

```bash
cd backend

# Create & activate a virtual environment
python -m venv .venv
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt

# Seed the database (admin + 15 rooms + 10 bookings)
python -m app.seed

# Run the API (http://127.0.0.1:8000, docs at /docs)
uvicorn app.main:app --reload
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/api/*` to the backend at `http://127.0.0.1:8000`.
If your backend runs elsewhere, copy `.env.example` to `.env` and set `VITE_PROXY_TARGET`.

### 3. Log in

| Username | Password |
|----------|----------|
| `admin`  | `admin123` |

---

## API Reference

All endpoints except `POST /login` require a `Bearer` token.

| Method | Path | Description |
|--------|------|-------------|
| POST   | `/login` | Authenticate, returns a JWT |
| GET    | `/me` | Current admin |
| GET    | `/dashboard` | Summary stats + recent bookings |
| GET    | `/rooms` | List rooms |
| GET    | `/rooms/{id}` | Get a room |
| POST   | `/rooms` | Create a room |
| PUT    | `/rooms/{id}` | Update a room |
| DELETE | `/rooms/{id}` | Delete a room |
| GET    | `/bookings` | List bookings |
| GET    | `/bookings/{id}` | Get a booking |
| POST   | `/bookings` | Create a booking |
| POST   | `/bookings/{id}/documents` | Attach ID documents (multipart `files`, images or PDF) |
| GET    | `/bookings/{id}/documents/{doc_id}` | Download a document |
| DELETE | `/bookings/{id}/documents/{doc_id}` | Remove a document |
| GET    | `/bookings/{id}/invoice` | Tax invoice PDF |
| PUT    | `/bookings/{id}` | Update a booking (also used to cancel / check-in / check-out) |
| DELETE | `/bookings/{id}` | Delete a booking |

Interactive docs are available at `http://127.0.0.1:8000/docs`.

---

## Business Rules & Validation

- Room numbers are unique; capacity and price must be greater than zero.
- Check-out must be after check-in; guest count cannot exceed room capacity.
- Overlapping bookings on the same room are rejected (cancelled bookings don't block).
- Rooms under maintenance are hidden from the booking form and cannot be booked.
- Setting a booking to **Checked In** marks its room **Occupied**; **Checked Out** or
  **Cancelled** releases the room back to **Available**.
- The API returns meaningful validation errors (409 for conflicts, 422 for invalid data).

---

## Migrations (Alembic)

Tables are auto-created on startup for convenience, so a fresh database is already current.
An **existing** `room.db` needs `alembic upgrade head` once to pick up the `bookings.address`
column; other newer booking columns are added automatically on startup.

For schema changes over time:

```bash
cd backend
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

---

## Notes

This is **Version 1 (MVP)** — a strong CRUD foundation for Rooms, Bookings, and the
Dashboard. Advanced features (payments, housekeeping, reports, analytics, multi-property,
staff management, customer portals) are intentionally out of scope and can be layered on
without major refactoring thanks to the models / schemas / services / routers separation.
