# Help Center Backend — Deploy Image
#
# Thin image that extends the pre-built base (Dockerfile.backend-base).
# Only copies application code and runs collectstatic — all heavy
# dependencies (system packages, uv, Python packages) live in the base
# image, making deploys fast (~1-2 min).
#
# Pass --build-arg BASE_REGISTRY=gcr.io/<project> to select the
# correct base image for each environment (dev vs prod).

ARG BASE_REGISTRY=gcr.io/pillar-production
FROM ${BASE_REGISTRY}/pillar-backend-base:latest

WORKDIR /app

# Copy project
COPY . .

# Create necessary directories (may already exist from base, but ensure)
RUN mkdir -p /app/static /app/media

# Expose port
EXPOSE 8000

# Collect static files
RUN python manage.py collectstatic --noinput || echo "Static files collection skipped"

# Start server with gunicorn + uvicorn workers (ASGI) for async support,
# process management, crash recovery, and worker recycling.
# Config lives in gunicorn.conf.py. Migrations run separately via GitHub Actions.
CMD ["gunicorn", "config.asgi:application", "-c", "gunicorn.conf.py"]
