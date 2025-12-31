# Basehook

A webhook management system that groups updates by thread ID and lets you consume them either one-by-one or buffered (latest revision only).

[![Demo Video](https://github.com/user-attachments/assets/7c12a04b-ed04-4962-8c48-d7111a787c91)](https://www.youtube.com/watch?v=qddNp3lVBGI)

## Core Concepts

**Thread-based grouping**: Webhooks are grouped by thread ID. Configure JSON paths to extract thread IDs and revision numbers from any format (Slack, GitHub, Shopify, etc.).

**Two consumption modes**:
- `pop(only_last_revision=False)` - Process updates one by one in order
- `pop(only_last_revision=True)` - Buffer updates and only consume the latest revision, skipping outdated ones

**Pull-based processing**: Your application pulls updates via `pop()` instead of receiving direct webhook POSTs. Failed processing is marked as ERROR and visible in the UI for manual retry.

## Quick Deploy

### Docker Compose (Self-hosting)

```bash
git clone https://github.com/mehdigmira/basehook.git
cd basehook
docker-compose up -d
```

Access at `http://localhost:8000`

### Railway (Cloud)

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/5ZGBSB?referralCode=6cnLlI&utm_medium=integration&utm_source=template&utm_campaign=generic)

One-click deploy with PostgreSQL auto-configured.

## Usage

### 1. Configure webhook
Visit the UI and create a webhook with thread ID and revision number paths.

### 2. Install client library
```bash
pip install basehook
```

### 3. Consume updates
```python
import asyncio
from basehook import Basehook

basehook = Basehook(database_url="postgresql+asyncpg://...")
webhook_name = ...

async def process_one():
    # Process updates one by one (in order)
    async with basehook.pop(webhook_name, only_last_revision=False) as update:
        if update:
            print(update)

async def process_last():
    # Process last
    async with basehook.pop(webhook_name, only_last_revision=True) as update:
        if update:
            print(update)

if __name__ == "__main__":
    asyncio.run(process_one())
```

## License

MIT
