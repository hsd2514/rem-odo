from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models import ExpenseStatus, Role


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=8)
    company_name: str
    country: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str = ""
    user_id: int = 0
    user_name: str = ""


class UserCreateRequest(BaseModel):
    name: str
    email: EmailStr
    role: Role
    manager_id: int | None = None


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: Role
    company_id: int
    manager_id: int | None = None
    manager_name: str | None = None


class UserMeResponse(BaseModel):
    id: int
    name: str
    email: str
    role: Role
    company_id: int
    company_name: str
    company_country: str
    default_currency: str


class CountryItem(BaseModel):
    name: str
    currency: str


class SendPasswordResponse(BaseModel):
    password: str
    message: str


class ApprovalFlowRequest(BaseModel):
    id: int | None = None
    user_id: int
    description: str
    category: str | None = None
    min_amount: float | None = None
    max_amount: float | None = None
    priority: int = 0
    is_active: bool = True
    manager_first: bool = True
    sequential: bool = True
    min_approval_percentage: int = Field(default=60, ge=1, le=100)
    approvers: list[int] = Field(default_factory=list)
    required_approvers: list[int] = Field(default_factory=list)


class ApprovalFlowResponse(BaseModel):
    id: int
    company_id: int
    user_id: int
    description: str
    category: str | None
    min_amount: float | None
    max_amount: float | None
    priority: int
    is_active: bool
    manager_first: bool
    sequential: bool
    min_approval_percentage: int
    approvers: list[int]
    required_approvers: list[int]


class ExpenseCreateRequest(BaseModel):
    amount: float
    category: str
    description: str
    expense_date: datetime
    paid_by: str
    currency: str
    remarks: str = ""


class ExpenseResponse(BaseModel):
    id: int
    user_id: int
    user_name: str = ""
    amount: float
    currency: str
    converted_amount: float
    base_currency: str
    category: str
    description: str
    paid_by: str
    expense_date: datetime
    remarks: str
    status: ExpenseStatus
    submitted_at: datetime


class ApprovalLogResponse(BaseModel):
    id: int
    expense_id: int
    approver_id: int
    approver_name: str = ""
    decision: str
    comment: str
    timestamp: datetime


class TimelineEventResponse(BaseModel):
    id: str
    event_type: str
    actor_id: int | None = None
    actor_name: str = ""
    actor_role: str = ""
    decision: str | None = None
    comment: str = ""
    message: str = ""
    step_order: int | None = None
    timestamp: datetime


class ExpenseTimelineResponse(BaseModel):
    expense_id: int
    status: ExpenseStatus
    events: list[TimelineEventResponse]


class AuditStreamItemResponse(BaseModel):
    id: str
    event_type: str
    expense_id: int
    expense_description: str
    actor_id: int | None = None
    actor_name: str = ""
    actor_role: str = ""
    decision: str | None = None
    message: str = ""
    timestamp: datetime


class ExpenseDetailResponse(BaseModel):
    expense: ExpenseResponse
    approval_logs: list[ApprovalLogResponse] = []
    receipt_url: str | None = None


class ApprovalDecisionRequest(BaseModel):
    comment: str = ""


class OCRResult(BaseModel):
    amount: float | None = None
    vendor: str | None = None
    expense_date: str | None = None
    category_guess: str | None = None


# ── Analytics ─────────────────────────────────────


class AnalyticsSummary(BaseModel):
    total_spend: float = 0.0
    total_count: int = 0
    pending_count: int = 0
    pending_amount: float = 0.0
    approved_count: int = 0
    approved_amount: float = 0.0
    rejected_count: int = 0
    rejected_amount: float = 0.0
    draft_count: int = 0
    avg_expense: float = 0.0


class MonthlySpendItem(BaseModel):
    year: int
    month: int
    month_label: str = ""
    total: float = 0.0
    approved: float = 0.0
    pending: float = 0.0
    rejected: float = 0.0
    draft: float = 0.0
    count: int = 0


class CategoryBreakdownItem(BaseModel):
    category: str
    total: float = 0.0
    count: int = 0
    percentage: float = 0.0


class TeamBreakdownItem(BaseModel):
    user_id: int
    user_name: str
    role: str
    total_spend: float = 0.0
    expense_count: int = 0
    pending_count: int = 0
    approved_count: int = 0
    rejected_count: int = 0
