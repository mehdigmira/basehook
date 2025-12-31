import time
from contextlib import asynccontextmanager
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from sqlalchemy import String, func, select, update as sql_update
from sqlalchemy.dialects.postgresql import insert

from basehook.core import Basehook
from basehook.hmac_utils import verify_hmac_signature
from basehook.models import (
    ThreadUpdateStatus,
    metadata,
    thread_table,
    thread_update_table,
    webhook_table,
)

basehook: Basehook | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global basehook
    basehook = Basehook()  # Create in event loop

    # Create tables - will fail if database is not available
    # Railway will restart the app when DATABASE_URL is added
    try:
        await basehook.create_tables(metadata)
        print("✓ Database tables created successfully")
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        print("Waiting for DATABASE_URL to be configured...")
        raise  # Let Railway restart the app

    yield
    # Optionally dispose
    await basehook.engine.dispose()


app = FastAPI(lifespan=lifespan)


def apply_filters_to_query(query, filters: list):
    """
    Apply filters to a SQLAlchemy query.

    Args:
        query: SQLAlchemy select query
        filters: List of filter objects with {id, value, operator}

    Returns:
        Modified query with filters applied
    """
    for filter_item in filters:
        field_name = filter_item.get("id")
        field_value = filter_item.get("value")
        operator = filter_item.get("operator", "iLike")

        # Check if column exists in table
        if not field_name or not hasattr(thread_update_table.c, field_name):
            continue

        column = func.cast(getattr(thread_update_table.c, field_name), String)

        # Apply operator
        if operator == "eq":
            query = query.where(func.lower(column) == func.lower(field_value))
        elif operator == "ne":
            query = query.where(func.lower(column) != func.lower(field_value))
        elif operator == "iLike":
            query = query.where(column.ilike(f"%{field_value}%"))
        elif operator == "notILike":
            query = query.where(~column.ilike(f"%{field_value}%"))
        elif operator == "isEmpty":
            query = query.where(column.is_(None))
        elif operator == "isNotEmpty":
            query = query.where(column.isnot(None))

    return query


def _get_from_json(json: Any, path: list[str]) -> Any:
    try:
        for key in path:
            if key.isdigit():
                json = json[int(key)]
            else:
                json = json[key]
    except (KeyError, IndexError):
        return None
    else:
        return json


def _get_revision_number(json: Any, path: list[str]) -> float:
    revision_number = _get_from_json(json, path)
    if revision_number is None or (
        not isinstance(revision_number, float) and not isinstance(revision_number, str)
    ):
        return time.time()

    try:
        revision_number = float(revision_number)
    except ValueError:
        return time.time()
    else:
        return revision_number


@app.post("/api/query")
async def query_thread_updates(request: Request):
    """
    Query thread updates with filtering, sorting, and pagination.

    Request body:
        {
            "page": 1,
            "per_page": 10,
            "range": "24h",  // Optional: 1h, 6h, 24h, 7d, 30d, all
            "filters": [
                {"id": "thread_id", "value": "thread-1"},
                {"id": "webhook_name", "value": "test"},
                {"id": "status", "value": ["PENDING", "SUCCESS"]}
            ],
            "sort": [
                {"id": "timestamp", "desc": true}
            ]
        }

    Returns:
        {
            "updates": [...],
            "total": 123,
            "page": 1,
            "per_page": 10,
            "total_pages": 13
        }
    """
    body = await request.json()

    # Extract pagination
    page = body.get("page", 1)
    per_page = body.get("per_page", 10)

    # Extract filters, sort, and time range
    filters = body.get("filters", [])
    sorts = body.get("sort", [])
    time_range = body.get("range", "all")

    # Calculate time range cutoff
    range_seconds = {
        "1h": 3600,
        "6h": 6 * 3600,
        "24h": 24 * 3600,
        "7d": 7 * 24 * 3600,
        "30d": 30 * 24 * 3600,
        "all": None,
    }
    cutoff_seconds = range_seconds.get(time_range, None)
    cutoff_timestamp = time.time() - cutoff_seconds if cutoff_seconds else None

    async with basehook.engine.begin() as conn:
        # Build base query
        query = select(thread_update_table)

        # Apply time range filter
        if cutoff_timestamp is not None:
            query = query.where(thread_update_table.c.timestamp >= cutoff_timestamp)

        # Apply filters
        query = apply_filters_to_query(query, filters)

        # Get total count before pagination
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await conn.execute(count_query)
        total = total_result.scalar() or 0

        # Apply sorting dynamically
        if sorts and isinstance(sorts, list):
            for sort_item in sorts:
                sort_field = sort_item.get("id")
                sort_desc = sort_item.get("desc", False)

                # Check if column exists
                if sort_field and hasattr(thread_update_table.c, sort_field):
                    column = getattr(thread_update_table.c, sort_field)
                    if sort_desc:
                        query = query.order_by(column.desc())
                    else:
                        query = query.order_by(column.asc())
        else:
            # Default sort by timestamp descending
            query = query.order_by(thread_update_table.c.timestamp.desc())

        # Apply pagination
        offset = (page - 1) * per_page
        query = query.offset(offset).limit(per_page)

        # Execute query
        result = await conn.execute(query)
        updates = result.all()

        return {
            "updates": [
                {
                    "id": u.id,
                    "webhook_name": u.webhook_name,
                    "thread_id": u.thread_id,
                    "revision_number": u.revision_number,
                    "content": u.content,
                    "timestamp": u.timestamp,
                    "status": u.status.value if hasattr(u.status, "value") else str(u.status),
                    "traceback": u.traceback,
                }
                for u in updates
            ],
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": (total + per_page - 1) // per_page,  # Ceiling division
        }


@app.post("/api/update-status")
async def update_status(request: Request):
    """
    Update the status of thread updates.

    Request body:
        {
            "thread_ids": ["id1", "id2"],  # Optional: specific IDs when rows selected
            "filters": [                    # Optional: filters when "select all" used
                {"id": "thread_id", "value": "thread-1", "operator": "eq"}
            ],
            "status": "SKIPPED"
        }

    Returns:
        {
            "updated": 10
        }
    """
    body = await request.json()

    # Extract parameters
    ids = body.get("ids", [])
    filters = body.get("filters", [])
    new_status = body.get("status")

    if not new_status:
        raise HTTPException(status_code=400, detail="status is required")

    # Validate status
    try:
        status_enum = ThreadUpdateStatus[new_status.upper()]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {new_status}")

    async with basehook.engine.begin() as conn:
        # Build update statement
        if ids:
            # Update specific IDs
            update_stmt = (
                sql_update(thread_update_table)
                .where(thread_update_table.c.id.in_(ids))
                .values(status=status_enum)
            )
        else:
            # Update based on filters
            query = select(thread_update_table.c.id)
            query = apply_filters_to_query(query, filters)

            update_stmt = (
                sql_update(thread_update_table)
                .where(thread_update_table.c.id.in_(query.scalar_subquery()))
                .values(status=status_enum)
            )

        result = await conn.execute(update_stmt)
        updated_count = result.rowcount

        return {"updated": updated_count}


@app.get("/api/metrics")
async def get_metrics(range: str = "24h"):
    """
    Get cumulative metrics for thread updates by status over time.
    Groups data into 10-second windows for better performance.

    Query params:
        range: Time range to fetch (1h, 6h, 24h, 7d, 30d, all). Default: 24h

    Returns:
        {
            "data": [
                {
                    "timestamp": 1234567890,
                    "date": "2024-01-01 12:00:00",
                    "pending": 10,
                    "success": 5,
                    "error": 2,
                    "skipped": 1
                },
                ...
            ]
        }
    """
    from sqlalchemy import Integer

    # Calculate cutoff timestamp and window size based on range
    range_config = {
        "1h": {"seconds": 3600, "window": 10},  # 10s windows for 1h
        "6h": {"seconds": 6 * 3600, "window": 60},  # 1min windows for 6h
        "24h": {"seconds": 24 * 3600, "window": 300},  # 5min windows for 24h
        "7d": {"seconds": 7 * 24 * 3600, "window": 3600},  # 1h windows for 7d
        "30d": {"seconds": 30 * 24 * 3600, "window": 4 * 3600},  # 4h windows for 30d
        "all": {"seconds": None, "window": 24 * 3600},  # 1d windows for all time
    }

    config = range_config.get(range, range_config["24h"])
    cutoff_seconds = config["seconds"]
    window_size = config["window"]
    cutoff_timestamp = time.time() - cutoff_seconds if cutoff_seconds else None

    async with basehook.engine.begin() as conn:
        # Group by dynamic windows based on time range
        window_expr = (thread_update_table.c.timestamp / window_size).cast(Integer) * window_size

        query = select(
            window_expr.label("window_timestamp"),
            thread_update_table.c.status,
            func.count().label("count"),
        )

        # Apply time range filter if not "all"
        if cutoff_timestamp is not None:
            query = query.where(thread_update_table.c.timestamp >= cutoff_timestamp)

        query = query.group_by(window_expr, thread_update_table.c.status).order_by(
            window_expr.asc(), thread_update_table.c.status.asc()
        )

        result = await conn.execute(query)
        rows = result.all()

        # Build cumulative counts
        cumulative = {ThreadUpdateStatus.PENDING: 0, ThreadUpdateStatus.SUCCESS: 0, ThreadUpdateStatus.ERROR: 0, ThreadUpdateStatus.SKIPPED: 0}
        data_points = []
        current_window = None

        for row in rows:
            # Accumulate count for this status
            if row.status in cumulative:
                cumulative[row.status] += row.count

            # If we hit a new window, push a data point with current cumulative totals
            if current_window is not None and row.window_timestamp != current_window:
                data_points.append({
                    "timestamp": current_window,
                    "date": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(current_window)),
                    "pending": cumulative[ThreadUpdateStatus.PENDING],
                    "success": cumulative[ThreadUpdateStatus.SUCCESS],
                    "error": cumulative[ThreadUpdateStatus.ERROR],
                    "skipped": cumulative[ThreadUpdateStatus.SKIPPED],
                })

            current_window = row.window_timestamp

        # Don't forget the last window
        if current_window is not None:
            data_points.append({
                "timestamp": current_window,
                "date": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(current_window)),
                "pending": cumulative[ThreadUpdateStatus.PENDING],
                "success": cumulative[ThreadUpdateStatus.SUCCESS],
                "error": cumulative[ThreadUpdateStatus.ERROR],
                "skipped": cumulative[ThreadUpdateStatus.SKIPPED],
            })

        return {"data": data_points}


@app.get("/api/webhooks")
async def list_webhooks():
    """
    Get list of all configured webhooks.

    Returns:
        {
            "webhooks": [
                {
                    "name": "my-webhook",
                    "thread_id_path": ["event", "thread_ts"],
                    "revision_number_path": ["event_time"],
                    "hmac_enabled": true,
                    "hmac_header": "X-Slack-Signature",
                    ...
                }
            ]
        }
    """
    async with basehook.engine.begin() as conn:
        query = select(webhook_table).order_by(webhook_table.c.name.asc())
        result = await conn.execute(query)
        webhooks = result.all()

        return {
            "webhooks": [
                {
                    "name": w.name,
                    "thread_id_path": w.thread_id_path,
                    "revision_number_path": w.revision_number_path,
                    "hmac_enabled": w.hmac_enabled,
                    "hmac_secret": w.hmac_secret,
                    "hmac_header": w.hmac_header,
                    "hmac_timestamp_header": w.hmac_timestamp_header,
                    "hmac_signature_format": w.hmac_signature_format,
                    "hmac_encoding": w.hmac_encoding,
                    "hmac_algorithm": w.hmac_algorithm,
                    "hmac_prefix": w.hmac_prefix,
                    "last_error": w.last_error,
                    "last_error_timestamp": w.last_error_timestamp,
                }
                for w in webhooks
            ]
        }


@app.post("/api/webhooks")
async def create_webhook(request: Request):
    """
    Create a new webhook configuration.

    Request body:
        {
            "name": "my-webhook",
            "thread_id_path": ["event", "thread_ts"],
            "revision_number_path": ["event_time"],
            "hmac_enabled": false,
            "hmac_secret": "optional-secret",
            "hmac_header": "X-Signature",
            "hmac_timestamp_header": "X-Timestamp",
            "hmac_signature_format": "{body}",
            "hmac_encoding": "hex",
            "hmac_algorithm": "sha256",
            "hmac_prefix": "sha256="
        }

    Returns:
        {
            "name": "my-webhook",
            ...
        }
    """
    body = await request.json()

    # Validate required fields
    if not body.get("name"):
        raise HTTPException(status_code=400, detail="Webhook name is required")
    if not body.get("thread_id_path"):
        raise HTTPException(status_code=400, detail="thread_id_path is required")
    if not body.get("revision_number_path"):
        raise HTTPException(
            status_code=400, detail="revision_number_path is required"
        )

    async with basehook.engine.begin() as conn:
        # Check if webhook already exists
        result = await conn.execute(
            select(webhook_table).where(webhook_table.c.name == body["name"])
        )
        existing = result.first()
        if existing:
            raise HTTPException(
                status_code=409, detail=f"Webhook '{body['name']}' already exists"
            )

        # Insert new webhook
        await conn.execute(
            insert(webhook_table).values(
                name=body["name"],
                thread_id_path=body["thread_id_path"],
                revision_number_path=body["revision_number_path"],
                hmac_enabled=body.get("hmac_enabled", False),
                hmac_secret=body.get("hmac_secret"),
                hmac_header=body.get("hmac_header"),
                hmac_timestamp_header=body.get("hmac_timestamp_header"),
                hmac_signature_format=body.get("hmac_signature_format"),
                hmac_encoding=body.get("hmac_encoding"),
                hmac_algorithm=body.get("hmac_algorithm"),
                hmac_prefix=body.get("hmac_prefix"),
            )
        )

        # Return the created webhook
        result = await conn.execute(
            select(webhook_table).where(webhook_table.c.name == body["name"])
        )
        webhook = result.first()

        return {
            "name": webhook.name,
            "thread_id_path": webhook.thread_id_path,
            "revision_number_path": webhook.revision_number_path,
            "hmac_enabled": webhook.hmac_enabled,
            "hmac_secret": webhook.hmac_secret,
            "hmac_header": webhook.hmac_header,
            "hmac_timestamp_header": webhook.hmac_timestamp_header,
            "hmac_signature_format": webhook.hmac_signature_format,
            "hmac_encoding": webhook.hmac_encoding,
            "hmac_algorithm": webhook.hmac_algorithm,
            "hmac_prefix": webhook.hmac_prefix,
            "last_error": webhook.last_error,
            "last_error_timestamp": webhook.last_error_timestamp,
        }


@app.put("/api/webhooks/{webhook_name}")
async def update_webhook(webhook_name: str, request: Request):
    """
    Update an existing webhook configuration.

    Request body:
        {
            "thread_id_path": ["event", "thread_ts"],
            "revision_number_path": ["event_time"],
            "hmac_enabled": true,
            "hmac_secret": "new-secret",
            ...
        }

    Returns:
        {
            "name": "my-webhook",
            ...
        }
    """
    body = await request.json()

    async with basehook.engine.begin() as conn:
        # Check if webhook exists
        result = await conn.execute(
            select(webhook_table).where(webhook_table.c.name == webhook_name)
        )
        existing = result.first()
        if not existing:
            raise HTTPException(
                status_code=404, detail=f"Webhook '{webhook_name}' not found"
            )





        # Update webhook
        await conn.execute(
            sql_update(webhook_table)
            .where(webhook_table.c.name == webhook_name)
            .values(**body)
        )




@app.post("/{webhook_name}")
async def read_root(webhook_name: str, request: Request):
    async with basehook.engine.begin() as conn:
        result = await conn.execute(
            select(webhook_table).where(webhook_table.c.name == webhook_name)
        )
        webhook_row = result.first()
        if webhook_row is None:
            raise HTTPException(status_code=404, detail="Webhook not found")

        # Get raw body for HMAC verification (must read before .json())
        body = await request.body()

        # Verify HMAC signature if enabled
        if webhook_row.hmac_enabled:
            try:
                if not webhook_row.hmac_secret:
                    error_msg = "HMAC enabled but no secret configured"
                    await conn.execute(
                        sql_update(webhook_table)
                        .where(webhook_table.c.name == webhook_name)
                        .values(last_error=error_msg, last_error_timestamp=time.time())
                    )
                    raise HTTPException(status_code=500, detail=error_msg)

                # Get signature from header
                signature_header = webhook_row.hmac_header or "X-Webhook-Signature"
                received_signature = request.headers.get(signature_header)
                if not received_signature:
                    error_msg = f"Missing signature header: {signature_header}"
                    await conn.execute(
                        sql_update(webhook_table)
                        .where(webhook_table.c.name == webhook_name)
                        .values(last_error=error_msg, last_error_timestamp=time.time())
                    )
                    raise HTTPException(status_code=401, detail=error_msg)

                # Get timestamp from header if configured
                timestamp = None
                if webhook_row.hmac_timestamp_header:
                    timestamp = request.headers.get(webhook_row.hmac_timestamp_header)

                # Verify signature
                is_valid = verify_hmac_signature(
                    secret=webhook_row.hmac_secret,
                    received_signature=received_signature,
                    body=body,
                    timestamp=timestamp,
                    url=str(request.url),
                    signature_format=webhook_row.hmac_signature_format or "{body}",
                    encoding=webhook_row.hmac_encoding or "hex",
                    prefix=webhook_row.hmac_prefix,
                    algorithm=webhook_row.hmac_algorithm or "sha256",
                )

                if not is_valid:
                    error_msg = "Invalid HMAC signature"
                    await conn.execute(
                        sql_update(webhook_table)
                        .where(webhook_table.c.name == webhook_name)
                        .values(last_error=error_msg, last_error_timestamp=time.time())
                    )
                    raise HTTPException(status_code=401, detail=error_msg)

                # Clear error on successful validation
                await conn.execute(
                    sql_update(webhook_table)
                    .where(webhook_table.c.name == webhook_name)
                    .values(last_error=None, last_error_timestamp=None)
                )

            except HTTPException:
                raise  # Re-raise HTTP exceptions
            except Exception as e:
                # Log unexpected errors
                error_msg = f"HMAC validation error: {str(e)}"
                await conn.execute(
                    sql_update(webhook_table)
                    .where(webhook_table.c.name == webhook_name)
                    .values(last_error=error_msg, last_error_timestamp=time.time())
                )
                raise HTTPException(status_code=500, detail=error_msg) from e

        # Parse JSON content from body
        import json

        content = json.loads(body)

        thread_id_value = _get_from_json(content, webhook_row.thread_id_path) or str(uuid4())
        if not isinstance(thread_id_value, str):
            thread_id_value = str(uuid4())
        revision_number = _get_revision_number(content, webhook_row.revision_number_path)

        await conn.execute(
            insert(thread_update_table).values(
                webhook_name=webhook_name,
                thread_id=thread_id_value,
                revision_number=revision_number,
                content=content,
                timestamp=time.time(),
                status=ThreadUpdateStatus.PENDING,
            )
        )
        await conn.execute(
            insert(thread_table)
            .values(
                webhook_name=webhook_name,
                thread_id=thread_id_value,
            )
            .on_conflict_do_nothing()
        )

        return {"message": "Thread created"}
