# Basehook

A modern webhook management system with thread-based updates and HMAC authentication.

## Quick Deploy

### 🐳 Docker Compose (Recommended for Self-Hosting)

The easiest way to run Basehook with all dependencies:

```bash
# Clone the repository
git clone https://github.com/mehdigmira/basehook.git
cd basehook

# Start everything (app + PostgreSQL)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop everything
docker-compose down
```

**What you get:**
- ✅ FastAPI application running on port 8000
- ✅ PostgreSQL database (automatically configured)
- ✅ Database tables created automatically
- ✅ Persistent data storage

Access your API at: `http://localhost:8000`

### ☁️ Railway (Cloud Hosting)

Deploy to Railway in 2 steps:

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/mehdigmira/basehook)

**Steps:**

1. **Click the button above** → Railway starts deploying your app
   - ⚠️ Initial deployment will fail (no database yet - this is expected!)
   - You'll see: "Database connection failed: ..."

2. **Add database**: In Railway dashboard, click "New" → "Database" → "Add PostgreSQL"
   - Railway detects the new `DATABASE_URL` environment variable
   - Railway automatically triggers a new deployment
   - ✅ App starts successfully with database connection!

**Why this works:** Railway's restart policy automatically redeploys your app when environment variables change.

**Features:**
- Free tier available
- Automatic HTTPS
- Environment variables auto-configured
- Built-in monitoring and logs

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
