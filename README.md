# Basehook

A modern Python 3.10+ project using pyproject.toml and src layout.

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
