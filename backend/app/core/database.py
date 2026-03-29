from collections.abc import Generator

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings

engine = create_engine(settings.database_url, echo=False)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    # Lightweight schema sync for existing databases without migrations.
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE expense "
                "ADD COLUMN IF NOT EXISTS applied_flow_id INTEGER"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE approvalflow "
                "ADD COLUMN IF NOT EXISTS category VARCHAR"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE approvalflow "
                "ADD COLUMN IF NOT EXISTS min_amount DOUBLE PRECISION"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE approvalflow "
                "ADD COLUMN IF NOT EXISTS max_amount DOUBLE PRECISION"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE approvalflow "
                "ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE approvalflow "
                "ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE approvalflow "
                "ADD COLUMN IF NOT EXISTS auto_approve_approvers JSON"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE receipt "
                "ADD COLUMN IF NOT EXISTS file_hash VARCHAR DEFAULT ''"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE expense "
                "ADD COLUMN IF NOT EXISTS escalated_to INTEGER"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE expense "
                "ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE expense "
                "ADD COLUMN IF NOT EXISTS escalation_reason VARCHAR"
            )
        )


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
