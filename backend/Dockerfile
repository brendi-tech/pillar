# Help Center Backend Dockerfile
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_SYSTEM_PYTHON=1

# Set work directory
WORKDIR /app

# Install system dependencies and uv
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    gcc \
    python3-dev \
    libpq-dev \
    curl \
    ca-certificates \
    && curl -LsSf https://astral.sh/uv/install.sh | sh \
    && rm -rf /var/lib/apt/lists/*

# Add uv to PATH
ENV PATH="/root/.local/bin:$PATH"

# Copy project files
COPY pyproject.toml uv.lock* ./

# Install Python dependencies
RUN uv sync --frozen --no-dev

# Add .venv to PATH so installed packages are available
ENV PATH="/app/.venv/bin:$PATH"

# Copy project
COPY . .

# Create necessary directories
RUN mkdir -p /app/static /app/media

# Expose port
EXPOSE 8000

# Collect static files
RUN python manage.py collectstatic --noinput || echo "Static files collection skipped"

# Start server with gunicorn + uvicorn workers (ASGI) for async support,
# process management, crash recovery, and worker recycling.
# Config lives in gunicorn.conf.py. Migrations run separately via GitHub Actions.
CMD ["gunicorn", "config.asgi:application", "-c", "gunicorn.conf.py"]
