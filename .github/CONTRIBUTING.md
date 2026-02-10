# Contributing to Pillar

Thanks for your interest in contributing. This guide covers how to set up a dev environment, run tests, and submit changes.

## Development Setup

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 17 with [pgvector](https://github.com/pgvector/pgvector) extension
- Redis 7+
- [uv](https://docs.astral.sh/uv/) (Python package manager)

### Quick Start

1. Clone the repo and start infrastructure:

```bash
git clone https://github.com/pillarhq/pillar.git
cd pillar
docker compose up -d  # Starts Postgres (pgvector) and Redis
```

2. Set up the backend:

```bash
cd backend
cp .env.example .env.local  # Edit with your API keys
uv sync                     # Install Python dependencies
uv run python manage.py migrate
uv run python manage.py runserver
```

3. Set up the frontend:

```bash
cd frontend
npm install
npm run dev
```

The admin dashboard runs at `http://localhost:3000` and the API at `http://localhost:8000`.

### Required API Keys

You need at least one AI provider key to run Pillar:

- `OPENAI_API_KEY` or `GOOGLE_API_KEY` or `OPENROUTER_API_KEY`
- `HATCHET_CLIENT_TOKEN` (for background workflows)

See `.env.example` for the full list of environment variables.

## Running Tests

### Backend

```bash
cd backend
uv run pytest apps/ -m "not workflow" --tb=short -v
```

### Frontend

```bash
cd frontend
npm test
```

### E2E Tests (require real API keys)

```bash
# Agent E2E
cd backend
uv run pytest tests/e2e/ -m e2e -v

# RAG E2E
uv run pytest tests/test_services/test_knowledge_rag_e2e.py -m e2e -v
```

## Submitting Changes

1. Fork the repo and create a branch from `main`.
2. Make your changes. Add tests if you're changing behavior.
3. Run the relevant test suite to make sure nothing breaks.
4. Open a pull request with a clear description of what changed and why.

### PR Guidelines

- Keep PRs focused. One feature or fix per PR.
- Write descriptive commit messages.
- If your change touches the backend, run `uv run pytest` before submitting.
- If your change touches the frontend, run `npm test` and `npm run type-check`.

## Project Structure

```
backend/          Python/Django API server
  apps/           Django apps (knowledge, analytics, mcp, products, users)
  common/         Shared services and utilities
  config/         Django settings and URL configuration
  tests/          Test suites

frontend/         Next.js admin dashboard and marketing site
  app/            Next.js App Router pages
  components/     React components
  lib/            API clients and utilities
  queries/        React Query hooks

packages/         SDK packages (MIT licensed)
  sdk/            Core JavaScript SDK
  sdk-react/      React bindings
  sdk-vue/        Vue bindings
  sdk-angular/    Angular bindings
  pillar-ui/      Embeddable UI components
```

## Contributor License Agreement

By submitting a pull request, you agree that your contributions may be used in the hosted version of Pillar under the same terms as the rest of the project. This allows us to offer Pillar as both an open source project and a hosted service.

## License

The core project (backend + frontend) is licensed under [AGPL-3.0](LICENSE). SDK packages in `packages/` are licensed under [MIT](packages/sdk/LICENSE).

## Questions?

Open an issue or start a discussion. We're happy to help.
