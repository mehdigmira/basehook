from enum import Enum

from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    Column,
    Float,
    Index,
    MetaData,
    String,
    Table,
    UniqueConstraint,
)
from sqlalchemy import (
    Enum as SQLAlchemyEnum,
)
from sqlalchemy.dialects.postgresql import JSONB

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
    Column("thread_id_fallback_path", ARRAY(String), nullable=True),
    Column("revision_number_path", ARRAY(String), nullable=False),
    Column("revision_number_fallback_path", ARRAY(String), nullable=True),
    # HMAC verification settings
    Column("hmac_enabled", Boolean, nullable=False, server_default="false"),
    Column("hmac_secret", String, nullable=True),  # Store encrypted in production
    Column("hmac_header", String, nullable=True),  # e.g., "X-Slack-Signature"
    Column("hmac_timestamp_header", String, nullable=True),  # e.g., "X-Slack-Request-Timestamp"
    Column("hmac_signature_format", String, nullable=True),  # e.g., "v0:{timestamp}:{body}"
    Column("hmac_encoding", String, nullable=True),  # "hex" or "base64"
    Column("hmac_algorithm", String, nullable=True),  # "sha256" or "sha1"
    Column("hmac_prefix", String, nullable=True),  # e.g., "v0=" or "sha256="
    # Error tracking
    Column("last_error", String, nullable=True),  # Last validation error message
    Column("last_error_timestamp", Float, nullable=True),  # When the error occurred
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
    Column("content", JSONB, nullable=False),  # JSONB for better compression and indexing
    Column("timestamp", Float, nullable=False),
    Column("status", SQLAlchemyEnum(ThreadUpdateStatus), nullable=False),
    Column("traceback", String, nullable=True),  # Error traceback for failed updates
    # Partial index for pending updates - optimizes pull.py queries
    Index(
        "ix_thread_update_timestamp_pending",
        "timestamp",
        postgresql_where="status = 'PENDING'",
    ),
)
