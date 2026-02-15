FROM python:3.12-slim

WORKDIR /app

# System deps for sentence-transformers
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/app ./app
COPY backend/migrations ./migrations
COPY backend/alembic.ini .

# Copy agents (imported by backend at runtime)
COPY agents ./agents

# Pre-download embedding model at build time (faster startup)
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Create uploads + data directories
RUN mkdir -p /app/uploads /app/data

EXPOSE 8000

# Run DB migrations on startup, then start the server
COPY backend/migrate.py .
CMD ["sh", "-c", "python migrate.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
