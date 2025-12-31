FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy source code
COPY pyproject.toml .
COPY src/ ./src/

# Install the package
RUN pip install -e .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "basehook.api:app", "--host", "0.0.0.0", "--port", "8000"]
