import time
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from basehook.core import get_engine
from basehook.models import ThreadUpdateStatus, thread_table, thread_update_table, webhook_table

app = FastAPI()


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


@app.post("/{webhook_name}")
async def read_root(webhook_name: str, request: Request):
    async with get_engine().begin() as conn:
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
