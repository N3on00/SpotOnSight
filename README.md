# SpotOnSight

SpotOnSight is a location-based social platform for discovering, saving, and sharing spots across web and mobile clients.

## Overview

- Frontend: Vue 3 application in `frontend/`
- Backend: FastAPI service with MongoDB persistence in `backend/`
- Mobile: Capacitor wrapper in `mobile/capacitor/`
- Infrastructure: local Docker and deployment scaffolding in `infrastructure/`

## Architecture

- `backend/api/` contains thin HTTP route definitions and generic CRUD helpers
- `backend/services/` contains application and domain logic
- `backend/repositories/` contains MongoDB access adapters
- `backend/models/` contains Pydantic request and response schemas
- `backend/core/` contains application wiring, lifecycle, and shared backend helpers
- `frontend/src/` contains the Vue app, routed views, reusable components, and client services

See `ARCHITECTURE.md` and `docs/` for deeper technical documentation.

## Repository Structure

```text
spotonsight/
|- backend/
|- frontend/
|- mobile/
|- infrastructure/
|- docs/
|- tests/
|- scripts/
|- .env.example
|- docker-compose.yml
|- README.md
```

## Development Setup

Prerequisites:

- Python 3.11+
- Node.js 20+
- MongoDB 7+
- Docker Desktop (recommended for local orchestration)

Backend:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
python backend/main.py
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Build Instructions

- Frontend production build: `cd frontend && npm run build`
- Backend tests: `python -m pytest tests/backend -q`
- Frontend tests: `cd frontend && npm run test:run`
- Full local stack: `docker compose up --build`

## Contribution Guidelines

- Base branches: `main` for releases, `develop` for integration
- Branch naming: `feature/<name>`, `fix/<name>`, `chore/<name>`
- Keep API routes thin and move business logic into `backend/services/`
- Follow the workflow in `CONTRIBUTING.md`
