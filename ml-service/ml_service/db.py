from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from ml_service.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)


@contextmanager
def get_db():
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def fetch_all(query: str, params: dict | None = None) -> list[dict]:
    with get_db() as session:
        result = session.execute(text(query), params or {})
        cols = result.keys()
        return [dict(zip(cols, row)) for row in result.fetchall()]


def fetch_one(query: str, params: dict | None = None) -> dict | None:
    rows = fetch_all(query, params)
    return rows[0] if rows else None


def execute(query: str, params: dict | None = None):
    with get_db() as session:
        session.execute(text(query), params or {})


def execute_many(query: str, params_list: list[dict]):
    if not params_list:
        return
    with get_db() as session:
        session.execute(text(query), params_list)
