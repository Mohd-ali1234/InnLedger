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
