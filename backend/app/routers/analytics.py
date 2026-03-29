"""Analytics aggregate endpoints — admin only."""

from __future__ import annotations

import calendar
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, extract, case
from sqlmodel import Session, select

from app.core.database import get_session
from app.deps import get_current_user, require_role
from app.models import Expense, ExpenseStatus, User
from app.schemas import (
    AnalyticsSummary,
    CategoryBreakdownItem,
    MonthlySpendItem,
    TopSpenderItem,
    TeamBreakdownItem,
)

router = APIRouter()


def _apply_filters(
    query,
    company_id: int,
    month: str | None = None,
    category: str | None = None,
    user_id: int | None = None,
):
    """Apply common filters to an Expense query."""
    query = query.where(Expense.company_id == company_id)
    if month:
        try:
            year, mon = month.split("-")
            query = query.where(extract("year", Expense.expense_date) == int(year))
            query = query.where(extract("month", Expense.expense_date) == int(mon))
        except (ValueError, AttributeError):
            pass
    if category:
        query = query.where(Expense.category == category)
    if user_id:
        query = query.where(Expense.user_id == user_id)
    return query


@router.get("/summary", response_model=AnalyticsSummary)
def analytics_summary(
    month: str | None = Query(None, description="YYYY-MM"),
    category: str | None = Query(None),
    user_id: int | None = Query(None),
    session: Session = Depends(get_session),
    _: User = Depends(require_role("admin", "manager", "employee")),
    current_user: User = Depends(get_current_user),
) -> AnalyticsSummary:
    base = select(Expense)
    base = _apply_filters(base, current_user.company_id, month, category, user_id)

    expenses = session.exec(base).all()

    total_spend = sum(e.converted_amount for e in expenses)
    total_count = len(expenses)
    pending = [e for e in expenses if e.status == ExpenseStatus.pending]
    approved = [e for e in expenses if e.status == ExpenseStatus.approved]
    rejected = [e for e in expenses if e.status == ExpenseStatus.rejected]
    drafts = [e for e in expenses if e.status == ExpenseStatus.draft]

    return AnalyticsSummary(
        total_spend=round(total_spend, 2),
        total_count=total_count,
        pending_count=len(pending),
        pending_amount=round(sum(e.converted_amount for e in pending), 2),
        approved_count=len(approved),
        approved_amount=round(sum(e.converted_amount for e in approved), 2),
        rejected_count=len(rejected),
        rejected_amount=round(sum(e.converted_amount for e in rejected), 2),
        draft_count=len(drafts),
        avg_expense=round(total_spend / total_count, 2) if total_count else 0,
    )


@router.get("/monthly-spend", response_model=list[MonthlySpendItem])
def monthly_spend(
    category: str | None = Query(None),
    user_id: int | None = Query(None),
    session: Session = Depends(get_session),
    _: User = Depends(require_role("admin", "manager", "employee")),
    current_user: User = Depends(get_current_user),
) -> list[MonthlySpendItem]:
    base = select(Expense).where(Expense.company_id == current_user.company_id)
    if category:
        base = base.where(Expense.category == category)
    if user_id:
        base = base.where(Expense.user_id == user_id)

    expenses = session.exec(base).all()

    buckets: dict[tuple[int, int], list[Expense]] = {}
    for exp in expenses:
        key = (exp.expense_date.year, exp.expense_date.month)
        buckets.setdefault(key, []).append(exp)

    now = datetime.utcnow()
    result: list[MonthlySpendItem] = []
    for offset in range(11, -1, -1):
        m = now.month - offset
        y = now.year
        while m <= 0:
            m += 12
            y -= 1
        items = buckets.get((y, m), [])
        result.append(
            MonthlySpendItem(
                year=y,
                month=m,
                month_label=calendar.month_abbr[m],
                total=round(sum(e.converted_amount for e in items), 2),
                approved=round(
                    sum(e.converted_amount for e in items if e.status == ExpenseStatus.approved), 2
                ),
                pending=round(
                    sum(e.converted_amount for e in items if e.status == ExpenseStatus.pending), 2
                ),
                rejected=round(
                    sum(e.converted_amount for e in items if e.status == ExpenseStatus.rejected), 2
                ),
                draft=round(
                    sum(e.converted_amount for e in items if e.status == ExpenseStatus.draft), 2
                ),
                count=len(items),
            )
        )
    return result


@router.get("/category-breakdown", response_model=list[CategoryBreakdownItem])
def category_breakdown(
    month: str | None = Query(None, description="YYYY-MM"),
    user_id: int | None = Query(None),
    session: Session = Depends(get_session),
    _: User = Depends(require_role("admin", "manager", "employee")),
    current_user: User = Depends(get_current_user),
) -> list[CategoryBreakdownItem]:
    base = select(Expense)
    base = _apply_filters(base, current_user.company_id, month, None, user_id)

    expenses = session.exec(base).all()

    cats: dict[str, dict] = {}
    grand_total = 0.0
    for exp in expenses:
        bucket = cats.setdefault(exp.category, {"total": 0.0, "count": 0})
        bucket["total"] += exp.converted_amount
        bucket["count"] += 1
        grand_total += exp.converted_amount

    result = [
        CategoryBreakdownItem(
            category=cat,
            total=round(data["total"], 2),
            count=data["count"],
            percentage=round(data["total"] / grand_total * 100, 1) if grand_total else 0,
        )
        for cat, data in cats.items()
    ]
    result.sort(key=lambda x: x.total, reverse=True)
    return result


@router.get("/team-breakdown", response_model=list[TeamBreakdownItem])
def team_breakdown(
    month: str | None = Query(None, description="YYYY-MM"),
    category: str | None = Query(None),
    session: Session = Depends(get_session),
    _: User = Depends(require_role("admin", "manager", "employee")),
    current_user: User = Depends(get_current_user),
) -> list[TeamBreakdownItem]:
    base = select(Expense)
    base = _apply_filters(base, current_user.company_id, month, category, None)

    expenses = session.exec(base).all()

    users_map: dict[int, dict] = {}
    for exp in expenses:
        bucket = users_map.setdefault(
            exp.user_id,
            {"total": 0.0, "count": 0, "pending": 0, "approved": 0, "rejected": 0},
        )
        bucket["total"] += exp.converted_amount
        bucket["count"] += 1
        if exp.status == ExpenseStatus.pending:
            bucket["pending"] += 1
        elif exp.status == ExpenseStatus.approved:
            bucket["approved"] += 1
        elif exp.status == ExpenseStatus.rejected:
            bucket["rejected"] += 1

    result: list[TeamBreakdownItem] = []
    for uid, data in users_map.items():
        user = session.get(User, uid)
        if not user:
            continue
        result.append(
            TeamBreakdownItem(
                user_id=uid,
                user_name=user.name,
                role=user.role.value,
                total_spend=round(data["total"], 2),
                expense_count=data["count"],
                pending_count=data["pending"],
                approved_count=data["approved"],
                rejected_count=data["rejected"],
            )
        )
    result.sort(key=lambda x: x.total_spend, reverse=True)
    return result


@router.get("/top-spenders", response_model=list[TopSpenderItem])
def top_spenders(
    month: str | None = Query(None, description="YYYY-MM"),
    category: str | None = Query(None),
    limit: int = Query(5, ge=1, le=50),
    session: Session = Depends(get_session),
    _: User = Depends(require_role("admin", "manager", "employee")),
    current_user: User = Depends(get_current_user),
) -> list[TopSpenderItem]:
    base = select(Expense)
    base = _apply_filters(base, current_user.company_id, month, category, None)
    expenses = session.exec(base).all()

    by_user: dict[int, dict] = {}
    for exp in expenses:
        bucket = by_user.setdefault(exp.user_id, {"total": 0.0, "count": 0})
        bucket["total"] += exp.converted_amount
        bucket["count"] += 1

    result: list[TopSpenderItem] = []
    for user_id, data in by_user.items():
        user = session.get(User, user_id)
        if not user:
            continue
        result.append(
            TopSpenderItem(
                user_id=user_id,
                user_name=user.name,
                total_spend=round(data["total"], 2),
                expense_count=data["count"],
            )
        )

    result.sort(key=lambda x: x.total_spend, reverse=True)
    return result[:limit]
