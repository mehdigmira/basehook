# Running Tests

## Setup

1. Install dev dependencies:
```bash
pip install -e ".[dev]"
```

2. Set up a test PostgreSQL database:
```bash
createdb basehook_test
```

3. Set the test database URL (optional, defaults to `postgresql+asyncpg://localhost/basehook_test`):
```bash
export TEST_DATABASE_URL="postgresql+asyncpg://user:password@localhost/basehook_test"
```

## Running Tests

Run all tests:
```bash
pytest
```

Run with coverage:
```bash
pytest --cov=basehook --cov-report=html
```

Run a specific test:
```bash
pytest tests/test_integration.py::test_basic_webhook_post_and_last_revision
```

## Test Coverage

The integration test covers:
1. Basic webhook POST and last_revision retrieval
2. Old revision handling (skipping outdated updates)
3. Multiple items in random order (ensures highest revision is processed)
4. Error handling (marking failed updates as ERROR status)
