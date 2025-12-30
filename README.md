# Basehook

A modern webhook management system with thread-based updates and HMAC authentication.

## Quick Deploy

### One-Click Deploy Options

#### 🟦 Render (True One-Click with Database)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/mehdigmira/basehook)

**Truly one-click!** Render reads `render.yaml` and automatically:
- Creates PostgreSQL database
- Deploys the application
- Connects everything
- No manual steps needed!

#### 🟪 Railway (2 clicks)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/mehdigmira/basehook)

1. Click button → deploys app
2. Click "New" → "Database" → "Add PostgreSQL"

#### 🟩 Fly.io (CLI required)

```bash
fly launch  # Creates app + Postgres automatically
fly deploy  # Deploys your app
```

#### 🐳 Docker Compose (Self-hosted, one command)

```bash
docker-compose up -d
```

Includes both app and PostgreSQL database!

## Project Structure

```
basehook/
├── src/
│   └── basehook/
│       ├── __init__.py
│       └── api.py
├── tests/
├── pyproject.toml
├── .gitignore
└── README.md
```

## Installation

### Development Setup

```bash
# Create a virtual environment
python3.10 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install the package in editable mode with dev dependencies
pip install -e ".[dev]"
```

## Usage

```python
from basehook import app

# Use the API
result = app.get("/example")
response = app.post("/example", {"key": "value"})
```

## Development

### Running Tests

```bash
pytest
```

### Code Formatting

```bash
# Format code with black
black src/ tests/

# Lint with ruff
ruff check src/ tests/
```

### Type Checking

```bash
mypy src/
```

## License

MIT
