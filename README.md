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
|- .env.production.example
|- .env.staging.example
|- docker-compose.dev.yml
|- docker-compose.prod.yml
|- README.md
```

## Environment Templates

- `.env.example` documents local development variables. Copy it to `.env` before running `docker compose -f docker-compose.dev.yml up --build`.
- `.env.staging.example` documents the variables expected for a staging deployment. Copy it to `.env.staging`, keep `APP_ENV_FILE=.env.staging`, and replace placeholder values outside the repository.
- `.env.production.example` documents the variables expected for a production deployment. Copy it to `.env.production`, keep `APP_ENV_FILE=.env.production`, and inject real values through your deployment platform or secret manager.

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

Docker compose development stack:

```bash
copy .env.example .env
docker compose -f docker-compose.dev.yml up --build
```

- Frontend dev server: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- MongoDB: `mongodb://localhost:27017`

## Build Instructions

- Frontend production build: `cd frontend && npm run build`
- Backend tests: `python -m pytest tests/backend -q`
- Frontend tests: `cd frontend && npm run test:run`

## Production-Like Local Run

```bash
copy .env.production.example .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml up --build
```

Staging uses the same compose file with the staging env file:

```bash
copy .env.staging.example .env.staging
docker compose --env-file .env.staging -f docker-compose.prod.yml up --build
```

- Reverse proxy entrypoint: `http://localhost`
- API path through proxy: `http://localhost/api`
- Backend and MongoDB stay on the internal network only

## Deployment Expectations

- `docker-compose.prod.yml` builds three internal services: `backend`, `frontend`, and `mongo`, plus one externally exposed `proxy` service.
- The backend runs under Uvicorn as a non-root user and exposes `/health` for container health checks.
- The frontend is built with Vite during image creation and served as static files by Nginx.
- The reverse proxy routes `/api` to the backend and `/` to the frontend, and is ready to sit behind a TLS terminator or to be extended with mounted TLS configuration.
- GitHub Actions automatically redeploys `main` to `/opt/spotonsight` over SSH after backend and frontend checks pass.

## CI/CD Secrets

- Add `VPS_HOST` and `VPS_PASSWORD` in GitHub Actions secrets.
- Deploy workflows now connect as the fixed SSH user `deploy`.
- The host key is learned during the workflow run with `ssh-keyscan` before connecting.
- Keep `/opt/spotonsight/.env.production` on the server and out of the repository.
- Ensure the server user can run `git` and `docker compose` in `/opt/spotonsight`.

## Secrets And Security Assumptions

- Do not commit `.env`, `.env.staging`, or `.env.production`.
- Real values for `JWT_SECRET`, admin credentials, and deployment-specific hostnames must be supplied outside the repository.
- TLS certificates, DNS, ingress, backups, and secret rotation remain deployment-platform responsibilities.

## Contribution Guidelines

- Base branches: `main` for releases, `develop` for integration
- Branch naming: `feature/<name>`, `fix/<name>`, `chore/<name>`
- Keep API routes thin and move business logic into `backend/services/`
- Follow the workflow in `CONTRIBUTING.md`
