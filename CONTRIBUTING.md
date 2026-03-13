# Contributing

## Branching

- `main`: production-ready releases
- `develop`: integration branch
- Feature work: `feature/<name>`
- Fixes: `fix/<name>`
- Maintenance: `chore/<name>`

## Workflow

1. Branch from `develop`.
2. Keep changes scoped to one concern.
3. Run relevant tests before opening a pull request.
4. Update documentation when behavior or structure changes.

## Quality Expectations

- Keep FastAPI route modules thin.
- Place business logic in `backend/services/`.
- Place database access in `backend/repositories/`.
- Preserve established Vue app patterns in `frontend/src/`.

## Verification

- `python -m pytest tests/backend -q`
- `cd frontend && npm run test:run`
- `cd frontend && npm run build`
