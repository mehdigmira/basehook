import asyncio
import time
from contextlib import asynccontextmanager
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from sqlalchemy import String, func, select, update as sql_update
from sqlalchemy.dialects.postgresql import insert

from basehook.core import Basehook
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
    await basehook.create_tables(metadata)
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

    # Extract filters and sort
    filters = body.get("filters", [])
    sorts = body.get("sort", [])

    async with basehook.engine.begin() as conn:
        # Build base query
        query = select(thread_update_table)

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


@app.post("/{webhook_name}")
async def read_root(webhook_name: str, request: Request):
    async with basehook.engine.begin() as conn:
        result = await conn.execute(
            select(webhook_table).where(webhook_table.c.name == webhook_name)
        )
        webhook_row = result.first()
        if webhook_row is None:
            raise HTTPException(status_code=404, detail="Webhook not found")

        content = await request.json()

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


if __name__ == "__main__":

    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
