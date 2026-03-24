# Deployment

SpotOnSight ships two compose entrypoints with different goals:

- `docker-compose.dev.yml` keeps local development fast with bind mounts, the Vite dev server, and an exposed MongoDB port.
- `docker-compose.prod.yml` models the production topology with internal-only app services and a single exposed reverse proxy.

## Expected Production Topology

- `proxy`: public HTTP entrypoint, routes `/api` to the backend and `/` to the static frontend
- `frontend`: Nginx container that serves the built Vite bundle only
- `backend`: FastAPI running under Uvicorn as a non-root user
- `mongo`: internal database container with no public port mapping

## Environment Files

- Copy `.env.staging.example` to `.env.staging` for staging.
- Copy `.env.production.example` to `.env.production` for production.
- Keep `APP_ENV_FILE` aligned with the filename you deploy.
- Replace every placeholder before deployment.
- Keep runtime env files outside version control and inject secrets through your deployment platform when possible.

## Local Production Simulation

```bash
copy .env.production.example .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml up --build
```

The reverse proxy listens on `http://localhost` and forwards `/api` requests to the backend container.

## GitHub Actions Deployment

The CI workflow redeploys automatically on every push to `main` after tests and frontend build succeed.

Required GitHub repository secrets:

- `VPS_HOST`
- `VPS_PASSWORD`

The deploy workflows connect over SSH as the fixed server user `deploy`.

Expected server state:

- The repository is cloned at `/opt/spotonsight`
- `/opt/spotonsight/.env.production` already exists with real values
- The SSH user can run `git` and `docker compose`
- Docker and the Compose plugin are installed on the server

## External Responsibilities

- DNS and public hostnames
- TLS certificates and certificate renewal
- Secret management for JWT keys and admin credentials
- Persistent storage and backup strategy for MongoDB
- Monitoring, logs, and alerting
