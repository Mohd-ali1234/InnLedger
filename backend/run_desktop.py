"""Entry point for the desktop build (PyInstaller exe / Electron shell).

Serves the API under /api and the built React app at /, with all data kept in the
per-user data folder passed by Electron (INN_DATA_DIR) so updates never touch it.
"""

import os
import secrets
import sys
from pathlib import Path

DATA_DIR = Path(os.environ.get("INN_DATA_DIR", Path(__file__).parent / "desktop-data")).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Settings are read from the environment when app.core.config is first imported,
# so these must be set before importing the app.
os.environ.setdefault("DATABASE_URL", "sqlite:///" + (DATA_DIR / "innledger.db").as_posix())
os.environ.setdefault("UPLOAD_DIR", str(DATA_DIR / "uploads"))

_secret_file = DATA_DIR / ".secret"
if not _secret_file.exists():
    _secret_file.write_text(secrets.token_hex(32))
os.environ.setdefault("SECRET_KEY", _secret_file.read_text().strip())

import uvicorn  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

from app.database.session import SessionLocal  # noqa: E402
from app.main import app as api_app  # noqa: E402
from app.seed import _seed_admin  # noqa: E402


def _static_dir() -> Path | None:
    """Built React app: bundled inside the exe, or frontend/dist in a source checkout."""
    bundled = Path(getattr(sys, "_MEIPASS", Path(__file__).parent)) / "static"
    source = Path(__file__).parent.parent / "frontend" / "dist"
    for p in (bundled, source):
        if (p / "index.html").exists():
            return p
    return None


with SessionLocal() as db:
    _seed_admin(db)

app = FastAPI(title="InnLedger", docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/api", api_app)
_static = _static_dir()
if _static:
    # Mounted last so /api wins.
    app.mount("/", StaticFiles(directory=_static, html=True), name="static")

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=int(os.environ.get("INN_PORT", "8765")),
        log_config=None,
    )
