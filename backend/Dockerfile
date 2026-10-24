 # ==============================================================================
# Production Dockerfile for UK Day-Ahead Wind Trading Desk FastAPI Backend
# Multi-stage/Slim image, non-root user execution, and container healthcheck
# ==============================================================================

FROM python:3.13-slim AS runner

# Install system dependencies (curl for healthcheck) and clean package cache
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user and group
RUN useradd -m -u 10001 -s /bin/bash appuser

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and compressed data snapshots
COPY app/ app/
COPY data/ data/

# Set ownership to non-root user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Set runtime environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

EXPOSE 8000

# Container healthcheck hitting /api/health
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

# Launch uvicorn ASGI production server
CMD ["uvicorn", "app.api:app", "--host", "0.0.0.0", "--port", "8000"]
