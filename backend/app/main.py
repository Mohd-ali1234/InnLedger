from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.database.session import Base, engine
from app.database.migrate import add_missing_columns
from app.routers import auth, bookings, dashboard, rooms, settings as hotel_settings

# Create tables on startup. For schema evolution use Alembic migrations (see alembic/).
Base.metadata.create_all(bind=engine)
add_missing_columns(engine)

app = FastAPI(title=settings.PROJECT_NAME, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(rooms.router)
app.include_router(bookings.router)
app.include_router(hotel_settings.router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
