# Development Setup

## Backend

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
python backend/main.py
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

## Tests

- `python -m pytest tests/backend -q`
- `cd frontend && npm run test:run`
