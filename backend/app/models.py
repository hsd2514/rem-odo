from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class Role(str, Enum):
    admin = "admin"
    manager = "manager"
    employee = "employee"


class ExpenseStatus(str, Enum):
    draft = "draft"
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    escalated = "escalated"


class Company(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    country: str
    default_currency: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    password_hash: str
    role: Role
    company_id: int = Field(foreign_key="company.id")
    is_active: bool = True
    must_change_password: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class EmployeeManagerMap(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: int = Field(foreign_key="user.id", index=True)
    manager_id: int = Field(foreign_key="user.id", index=True)


class ApprovalFlow(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    company_id: int = Field(foreign_key="company.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    description: str
    category: str | None = None
    min_amount: float | None = None
    max_amount: float | None = None
    priority: int = 0
    is_active: bool = True
    manager_first: bool = True
    sequential: bool = True
    min_approval_percentage: int = 60
    approvers: list[int] = Field(default_factory=list, sa_column=Column(JSON))
    required_approvers: list[int] = Field(default_factory=list, sa_column=Column(JSON))
    auto_approve_approvers: list[int] = Field(default_factory=list, sa_column=Column(JSON))


class Expense(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    company_id: int = Field(foreign_key="company.id", index=True)
    amount: float
    currency: str
    converted_amount: float = 0.0
    base_currency: str = ""
    category: str
    description: str
    paid_by: str
    expense_date: datetime
    remarks: str = ""
    applied_flow_id: int | None = Field(default=None, foreign_key="approvalflow.id", index=True)
    status: ExpenseStatus = ExpenseStatus.draft
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    escalated_to: int | None = Field(default=None, foreign_key="user.id")
    escalated_at: datetime | None = None
    escalation_reason: str = ""


class Receipt(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    expense_id: Optional[int] = Field(default=None, foreign_key="expense.id", index=True)
    file_name: str
    file_path: str = ""
    mime_type: str = "image/jpeg"
    file_hash: str = Field(default="", index=True)  # SHA-256 of raw bytes for duplicate detection
    ocr_payload: dict = Field(default_factory=dict, sa_column=Column(JSON))


class ApprovalStep(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    expense_id: int = Field(foreign_key="expense.id", index=True)
    approver_id: int = Field(foreign_key="user.id", index=True)
    sequence_order: int
    required: bool = False
    status: str = "pending"


class ApprovalLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    expense_id: int = Field(foreign_key="expense.id", index=True)
    approver_id: int = Field(foreign_key="user.id")
    decision: str
    comment: str = ""
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AuditEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    company_id: int = Field(foreign_key="company.id", index=True)
    event_type: str
    actor_id: int | None = Field(default=None, foreign_key="user.id")
    actor_role: str = ""
    entity_type: str = ""
    entity_id: int | None = None
    message: str = ""
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SessionToken(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    refresh_token: str = Field(unique=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
