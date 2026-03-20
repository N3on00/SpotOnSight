# System Overview

SpotOnSight ships one product surface across web and mobile.

- `frontend/` contains the Vue application
- `backend/` contains the FastAPI API and MongoDB integration
- `mobile/capacitor/` contains native Android and iOS wrappers around the frontend build
- `tests/backend/` contains backend verification coverage

The target architectural direction is actor-oriented and business-data-driven:

- reusable actors provide narrow capabilities
- workflow definitions decide which actors execute
- orchestration is planned from business data rather than hard-coded per feature

See `docs/architecture/actor-runtime.md` for the detailed model and UML.
