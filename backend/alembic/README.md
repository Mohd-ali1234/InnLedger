# Database migrations (Alembic)

The app auto-creates tables on startup via `Base.metadata.create_all`, which is
enough for local development. For schema changes over time, use Alembic:

```bash
# Generate a migration from model changes
alembic revision --autogenerate -m "describe change"

# Apply migrations
alembic upgrade head
```

`alembic/env.py` reads the database URL and model metadata directly from the app,
so no additional wiring is required.
