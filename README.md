# Reimbursement Management System Monorepo

## Stack

- Frontend: React (Vite), Tailwind CSS v4, React Router, React Query, Context API, shadcn-style UI primitives
- Backend: FastAPI, SQLModel/SQLAlchemy, PostgreSQL, JWT auth, OCR service hook, external currency APIs

## Run PostgreSQL

```bash
docker compose up -d postgres
```

## Backend setup

```bash
cd backend
copy .env.example .env
uv sync
uv run uvicorn main:app --reload --port 8000
```

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

## API endpoints

- `POST /auth/signup`
- `POST /auth/login`
- `GET /users`
- `POST /users`
- `POST /expenses`
- `GET /expenses/my`
- `GET /expenses/team`
- `POST /approvals/{expense_id}/approve`
- `POST /approvals/{expense_id}/reject`
- `POST /workflow/create`
- `PATCH /workflow/update`
