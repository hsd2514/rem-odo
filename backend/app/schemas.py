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
    user_id: int
    description: str
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
