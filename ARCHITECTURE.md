# SpotOnSight Architecture

SpotOnSight follows a modular product structure built around a Vue frontend, a FastAPI backend, MongoDB persistence, and a Capacitor mobile shell.

## System Layout

- `frontend/` delivers the browser application and shared client logic
- `backend/` exposes authentication, social, discovery, and support APIs
- `mobile/capacitor/` packages the frontend build into Android and iOS shells
- `infrastructure/` holds container and deployment support files

## Backend Layers

- `backend/api/`: FastAPI routes and generic CRUD route builders
- `backend/services/`: business workflows and orchestration
- `backend/repositories/`: MongoDB repository adapters
- `backend/models/`: Pydantic contracts
- `backend/core/`: app startup, admin bootstrap, registry, and shared social helpers

## Frontend Layers

- `frontend/src/views/`: route-level screens
- `frontend/src/components/`: reusable UI modules
- `frontend/src/router/`: route definitions and navigation wiring
- `frontend/src/stores/`: application state persistence and hydration
- `frontend/src/services/`: API and platform-facing service layer

## Cross-Cutting Rules

- Routes/controllers stay thin and delegate decisions to services
- Services own business rules and coordinate repository access
- Repositories encapsulate MongoDB queries and indexes
- Mobile wraps the web app instead of duplicating product logic

Additional architecture notes live in `docs/architecture/`.
