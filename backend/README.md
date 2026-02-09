# Help Center Backend

Standalone Django backend for the Help Center product.

## Overview

This is a standalone backend extracted from the main Pillar monolithic backend, enabling:
- Independent deployment
- Reduced coupling
- Optimized architecture for help center features

## Quick Start

### Prerequisites

- Python 3.12+
- PostgreSQL (with pgvector extension)
- Redis

### Development Setup

1. **Install dependencies:**
   ```bash
   cd help-center-backend
   uv sync
   ```

2. **Run migrations:**
   ```bash
   python manage.py migrate
   ```

3. **Start development server:**
   ```bash
   python manage.py runserver 8003
   ```

4. **Verify it's working:**
   ```bash
   # Health check
   curl http://localhost:8003/health/

   # Readiness check (verifies DB and Redis)
   curl http://localhost:8003/health/ready/
   ```

### Environment Variables

The backend uses the root `.env.local` file (same as main backend). Key variables:

- `POSTGRES_*` - Database connection
- `REDIS_URL` - Cache
- `DJANGO_SECRET_KEY` - Security key
- `DJANGO_SETTINGS_MODULE` - Settings module

### API Documentation

Visit `http://localhost:8003/api/docs/` (requires superuser login via `/admin/`).

## Project Structure

```
help-center-backend/
├── config/           # Django configuration
│   ├── settings/     # Environment-specific settings
│   ├── urls.py       # URL routing
│   └── wsgi.py       # WSGI entry point
├── apps/             # Django applications (Phase 3+)
├── common/           # Shared utilities
│   ├── health/       # Health check endpoints
│   ├── pagination.py # DRF pagination classes
│   └── exceptions.py # Custom exception handling
├── manage.py         # Django CLI
└── pyproject.toml    # Dependencies
```

## Development Phases

- **Phase 1** (Current): Foundation - Django scaffolding
- **Phase 2**: Infrastructure - LLM clients, RAG services
- **Phase 3**: Data Models - Help center models
- **Phase 4**: Authentication - User/Organization models
- **Phase 5**: Public API - Public-facing endpoints
- **Phase 6**: Admin API - Admin CRUD endpoints
- **Phase 7-9**: Sources, Automation, Insights
- **Phase 10**: Deployment & Migration

## License

AGPL-3.0
