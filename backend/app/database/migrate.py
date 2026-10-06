"""Tiny additive migration: add any model columns missing from existing SQLite tables.

`Base.metadata.create_all` creates new tables but never alters existing ones, so columns
added to a model later would otherwise be missing from an existing room.db.
"""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.database.session import Base


def add_missing_columns(engine: Engine) -> None:
    insp = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not insp.has_table(table.name):
                continue
            existing = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name in existing:
                    continue
                ddl = f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {col.type.compile(engine.dialect)}'
                default = col.default.arg if col.default is not None and not callable(col.default.arg) else None
                if default is not None:
                    ddl += " NOT NULL DEFAULT " + (f"'{default}'" if isinstance(default, str) else str(default))
                conn.execute(text(ddl))


def relax_booking_constraints(engine: Engine) -> None:
    """Rebuild `bookings` if it still has NOT NULL on email / check_out (now optional).

    SQLite can't drop NOT NULL in place, so use the documented create-copy-drop-rename
    procedure. Rows, ids and the documents table's references are preserved.
    """
    if engine.dialect.name != "sqlite":
        return
    insp = inspect(engine)
    if not insp.has_table("bookings"):
        return
    cols = {c["name"]: c for c in insp.get_columns("bookings")}
    if cols["email"]["nullable"] and cols["check_out"]["nullable"]:
        return

    from sqlalchemy.schema import CreateTable

    table = Base.metadata.tables["bookings"]
    ddl = str(CreateTable(table).compile(engine)).replace(
        "CREATE TABLE bookings", "CREATE TABLE bookings_new", 1
    )
    shared = ", ".join(f'"{n}"' for n in cols if n in table.columns)

    raw = engine.raw_connection()
    try:
        cur = raw.cursor()
        cur.execute("PRAGMA foreign_keys=OFF")
        cur.execute("BEGIN")
        cur.execute("DROP TABLE IF EXISTS bookings_new")
        cur.execute(ddl)
        cur.execute(f"INSERT INTO bookings_new ({shared}) SELECT {shared} FROM bookings")
        cur.execute("DROP TABLE bookings")
        cur.execute("ALTER TABLE bookings_new RENAME TO bookings")
        for idx in table.indexes:
            cols_sql = ", ".join(f'"{c.name}"' for c in idx.columns)
            cur.execute(f'CREATE {"UNIQUE " if idx.unique else ""}INDEX "{idx.name}" ON bookings ({cols_sql})')
        cur.execute("COMMIT")
        cur.execute("PRAGMA foreign_keys=ON")
    except Exception:
        raw.rollback()
        raise
    finally:
        raw.close()


def backfill_booking_rooms(engine: Engine) -> None:
    """Give bookings created before multi-room support their single room line."""
    insp = inspect(engine)
    if not (insp.has_table("bookings") and insp.has_table("booking_rooms")):
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO booking_rooms (booking_id, room_id, rate) "
                "SELECT b.id, b.room_id, COALESCE(b.rate, r.price) "
                "FROM bookings b JOIN rooms r ON r.id = b.room_id "
                "WHERE NOT EXISTS (SELECT 1 FROM booking_rooms br WHERE br.booking_id = b.id)"
            )
        )
