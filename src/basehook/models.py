from enum import Enum

from sqlalchemy import (
    ARRAY,
    JSON,
    BigInteger,
    Column,
    Float,
    MetaData,
    String,
    Table,
    UniqueConstraint,
)
from sqlalchemy import (
    Enum as SQLAlchemyEnum,
)

metadata = MetaData()


class ThreadUpdateStatus(Enum):
    SKIPPED = "skipped"
    PENDING = "pending"
    SUCCESS = "success"
    ERROR = "error"


webhook_table = Table(
    "webhook",
    metadata,
    Column("name", String, primary_key=True),
    Column("thread_id_path", ARRAY(String), nullable=False),
    Column("revision_number_path", ARRAY(String), nullable=False),
)

thread_table = Table(
    "thread",
    metadata,
    Column("webhook_name", String, nullable=False),
    Column("thread_id", String, nullable=False),
    Column("last_revision_number", Float, nullable=True),
    UniqueConstraint("webhook_name", "thread_id"),
)

thread_update_table = Table(
    "thread_update",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column("webhook_name", String, nullable=False),
    Column("thread_id", String, nullable=False, index=True),
    Column("revision_number", Float, nullable=False),
    Column("content", JSON, nullable=False),
    Column("timestamp", Float, nullable=False),
    Column("status", SQLAlchemyEnum(ThreadUpdateStatus), nullable=False),
)
