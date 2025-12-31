# Basehook

A webhook management system that handles thread-based updates with deduplication.

## Core Concepts

**Thread-based updates**: Group related webhook events by thread ID and track their revision numbers to ensure proper ordering and deduplication.

**Flexible path extraction**: Configure JSON paths to extract thread IDs and revision numbers from any webhook format (Slack, GitHub, Shopify, etc.).

**Pull-based processing**: Your application pulls pending updates via `pull()` rather than receiving direct webhook POSTs, enabling safe processing with automatic retry on failure.

## Quick Deploy

### Docker Compose (Self-hosting)

```bash
git clone https://github.com/mehdigmira/basehook.git
cd basehook
docker-compose up -d
```

Access at `http://localhost:8000`

### Railway (Cloud)

1. Deploy to Railway
2. Add PostgreSQL database in Railway UI
3. Railway auto-restarts with `DATABASE_URL` configured

## Development Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn basehook.api:app --reload
```

Frontend (optional):
```bash
cd frontend/app
npm install
npm run dev
```

## Usage

```python
from basehook import Basehook

basehook = Basehook(database_url="postgresql+asyncpg://...")
await basehook.create_tables(metadata)

# Pull pending updates for a thread
async for update in basehook.pull("webhook-name", "thread-123"):
    process(update)  # Your processing logic
    # Update marked as SUCCESS if no exception
    # Update marked as ERROR if exception raised
```

Configure webhooks via the web UI at `/webhooks` or API at `/api/webhooks`.

## License

MIT
