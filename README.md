# Reimbursement Management System (Monorepo)

[![Repo](https://img.shields.io/badge/GitHub-rem--odo-black?logo=github)](https://github.com/hsd2514/rem-odo)
[![Stars](https://img.shields.io/github/stars/hsd2514/rem-odo?style=flat)](https://github.com/hsd2514/rem-odo/stargazers)
[![Forks](https://img.shields.io/github/forks/hsd2514/rem-odo?style=flat)](https://github.com/hsd2514/rem-odo/network/members)
[![Open Issues](https://img.shields.io/github/issues/hsd2514/rem-odo)](https://github.com/hsd2514/rem-odo/issues)
[![Open PRs](https://img.shields.io/github/issues-pr/hsd2514/rem-odo)](https://github.com/hsd2514/rem-odo/pulls)
[![Last Commit](https://img.shields.io/github/last-commit/hsd2514/rem-odo)](https://github.com/hsd2514/rem-odo/commits/master)

[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-Frontend-61DAFB?logo=react&logoColor=111)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-Build-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-Styling-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![JWT](https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens)](https://jwt.io/)

End-to-end reimbursement platform with role-based access, OCR-assisted expense entry, multi-stage approvals, analytics, audit stream, and demo-ready seeded data.

## Highlights
- Role-based product flows for `admin`, `manager`, and `employee`.
- Company-aware access control for all major resources.
- Currency normalization with conversion preview.
- OCR receipt extraction with duplicate detection.
- Workflow engine with manager-first, sequence, required approvers, and percentage rules.
- Manager inbox with filters/sort/presets and bulk decisions.
- Escalation flow with timeline + audit events.
- Admin company-wide expense explorer and override approval APIs.
- Analytics dashboards and audit stream for demo storytelling.

## Architecture
`frontend (React + Vite)` -> `FastAPI API layer` -> `services` -> `PostgreSQL`

External integrations:
- `restcountries` for country/currency defaults.
- Exchange-rate provider for conversion.
- Tesseract-based OCR service integration path.

## Tech Stack
### Backend
- Python (`uv` for environment/dependencies)
- FastAPI + SQLModel/SQLAlchemy
- PostgreSQL (`psycopg`)
- JWT auth (access + refresh)
- OCR + currency service modules

### Frontend
- React (JavaScript)
- Vite
- Tailwind CSS v4
- React Router
- React Query + Context
- Recharts + Lucide icons

## Features
### Authentication & Accounts
- Signup creates company + admin.
- Login issues access/refresh tokens.
- Logout and refresh token lifecycle.
- Forgot/reset password flow (email service fallback to console).
- Session auto-recovery and stale-token cleanup in frontend auth context.

### User & Org Management
- Admin creates users (employee/manager).
- Manager mapping updates.
- Password reset generation per user (`send-password`).

### Expense Management
- Employee draft/create/edit/submit lifecycle.
- Receipt upload + OCR autofill data extraction.
- Duplicate receipt detection metadata.
- Multi-currency expense capture with conversion.
- Receipt linking to expense and detail view.
- Employee tabs/tracking by status.

### Approval Engine
- Rule-driven approver selection by user/category/amount bands/priority.
- Manager-first and sequential options.
- Required approvers and minimum approval percentage.
- Manager/admin approve/reject with logs.
- Admin override approve/reject APIs.
- Expense escalation endpoint and timeline integration.

### Manager Experience
- Team inbox with:
- Search and advanced filters.
- Sort controls.
- Saved presets.
- Bulk approve/reject.
- Inline comments.
- Mobile-friendly approvals UI.

### Admin Experience
- Company-wide expenses view (`/admin/expenses`).
- Approval rules configuration UI.
- Analytics dashboards (summary/monthly/category/team/top spenders).
- Audit stream UI for activity history.

## Repo Structure
```text
.
├─ backend/
│  ├─ app/
│  │  ├─ routers/
│  │  ├─ services/
│  │  ├─ core/
│  │  ├─ models.py
│  │  ├─ schemas.py
│  │  └─ seed.py
│  ├─ pyproject.toml
│  └─ README.md
├─ frontend/
│  ├─ src/
│  │  ├─ pages/
│  │  ├─ components/
│  │  ├─ context/
│  │  └─ lib/
│  ├─ package.json
│  └─ README.md
└─ docker-compose.yml
```

## Quick Start
### 1) Start PostgreSQL
```bash
docker compose up -d postgres
```

### 2) Backend setup
```bash
cd backend
copy .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

### 3) Frontend setup
```bash
cd frontend
npm install
npm run dev
```

Frontend default: `http://localhost:5173`  
Backend default: `http://localhost:8000`

## Seed Demo Data
Run from `backend/`:
```bash
uv run python -m app.seed
```

Seeded accounts:
- `admin@acme.com / admin123`
- `sarah@acme.com / manager123`
- `john@acme.com / manager123`
- `marc@acme.com / employee123`
- `alice@acme.com / employee123`
- `raj@acme.com / employee123`

The seed includes drafts, pending, approved, rejected, and escalated expenses with logs/steps for demos.

## API Surface (Key Routes)
### Auth
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/me`

### Users
- `GET /users`
- `POST /users`
- `PATCH /users/{user_id}`
- `POST /users/{user_id}/send-password`

### Expenses
- `POST /expenses`
- `PATCH /expenses/{expense_id}`
- `POST /expenses/{expense_id}/submit`
- `GET /expenses/my`
- `GET /expenses/team`
- `GET /expenses/company`
- `POST /expenses/upload-receipt`
- `POST /expenses/{expense_id}/attach-receipt`
- `GET /expenses/{expense_id}`
- `GET /expenses/{expense_id}/timeline`
- `POST /expenses/{expense_id}/escalate`
- `GET /expenses/preview-conversion`

### Approvals
- `POST /approvals/{expense_id}/approve`
- `POST /approvals/{expense_id}/reject`
- `POST /approvals/{expense_id}/override-approve`
- `POST /approvals/{expense_id}/override-reject`
- `GET /approvals/{expense_id}/logs`
- `GET /approvals/{expense_id}/steps`

### Workflow / Analytics / Audit
- `POST /workflow/create`
- `PATCH /workflow/update`
- `GET /workflow/{user_id}`
- `GET /analytics/summary`
- `GET /analytics/monthly-spend`
- `GET /analytics/category-breakdown`
- `GET /analytics/team-breakdown`
- `GET /analytics/top-spenders`
- `GET /audit/stream`

## Testing
From `backend/`:
```bash
uv run pytest
```

## Docker Notes
`docker-compose.yml` provisions PostgreSQL only. App services run locally via `uv` and `npm`.

## Team Workflow
- Open feature branch.
- Implement + test.
- Open PR.
- Merge to `master`.
- Close linked issue.

---
Built for fast demos and iterative product development.
