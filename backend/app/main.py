from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import settings
from app.core.database import init_db
from app.routers import analytics, approvals, audit, auth, bootstrap, expenses, users, workflow

app = FastAPI(title="Reimbursement Management API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(expenses.router, prefix="/expenses", tags=["expenses"])
app.include_router(approvals.router, prefix="/approvals", tags=["approvals"])
app.include_router(workflow.router, prefix="/workflow", tags=["workflow"])
app.include_router(audit.router, prefix="/audit", tags=["audit"])
app.include_router(bootstrap.router, prefix="/bootstrap", tags=["bootstrap"])
app.include_router(bootstrap.router, prefix="/demo", tags=["legacy-demo"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

