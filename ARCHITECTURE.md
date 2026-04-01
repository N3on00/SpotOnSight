# SpotOnSight Architecture

SpotOnSight follows a modular product structure built around a Vue frontend, a FastAPI backend, MongoDB persistence, and a Capacitor mobile shell.

## System Layout

- `frontend/` delivers the browser application and shared client logic
- `backend/` exposes authentication, social, discovery, and support APIs
- `mobile/capacitor/` packages the frontend build into Android and iOS shells
- `infrastructure/` holds container and deployment support files

## Backend Layers

- `backend/api/`: explicit FastAPI route modules plus route manifests
- `backend/services/`: auth and platform-facing service helpers
- `backend/repositories/`: MongoDB repository adapters
- `backend/models/`: Pydantic contracts and endpoint factories
- `backend/core/`: app startup, social actions, workflow runtime, policies, and shared helpers

## Frontend Layers

- `frontend/src/views/`: route-level screens
- `frontend/src/components/`: reusable UI modules
- `frontend/src/router/`: route definitions and navigation wiring
- `frontend/src/stores/`: application state persistence and hydration
- `frontend/src/services/`: API and platform-facing service layer
- `frontend/src/actions/`: app actions that orchestrate flows and own state mutation
- `frontend/src/actors/`: actor manifests that declare services, actions, UI bindings, and runtime bindings

## Cross-Cutting Rules

- Route modules stay thin and delegate business decisions to action/workflow layers
- Frontend actions own orchestration and state mutation; services return data or perform external IO
- Repositories encapsulate MongoDB queries and indexes
- Mobile wraps the web app instead of duplicating product logic

## Runtime Direction

SpotOnSight now uses a generic-once, data-declared structure:

- frontend actor manifests declare services, actions, UI registration, and runtime bindings
- backend route manifests declare the varying HTTP surface while the route builder stays generic
- social domain behavior is split into focused action modules plus reusable workflow primitives
- policies hold permission checks and business rules close to the domain helpers that use them

Detailed UML and orchestration guidance live in `docs/architecture/actor-runtime.md`.

Additional architecture notes live in `docs/architecture/`.
