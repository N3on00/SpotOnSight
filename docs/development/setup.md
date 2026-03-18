# Development Setup

## Environment File

Copy `.env.example` to `.env` before starting the Docker development stack.

```bash
copy .env.example .env
```

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

## Docker Development Stack

```bash
docker compose -f docker-compose.dev.yml up --build
```

- Frontend dev server: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- MongoDB: `mongodb://localhost:27017`
