from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.core.database import get_session
from app.deps import get_current_user, require_role
from app.models import ApprovalLog, AuditEvent, Expense, User
from app.schemas import AuditStreamItemResponse

router = APIRouter()


@router.get("/stream", response_model=list[AuditStreamItemResponse])
def audit_stream(
    limit: int = 100,
    session: Session = Depends(get_session),
    _: User = Depends(require_role("admin", "manager", "employee")),
    current_user: User = Depends(get_current_user),
) -> list[AuditStreamItemResponse]:
    safe_limit = max(1, min(limit, 500))

    expenses = session.exec(
        select(Expense)
        .where(Expense.company_id == current_user.company_id)
        .order_by(Expense.submitted_at.desc())
    ).all()
    logs = session.exec(
        select(ApprovalLog)
        .join(Expense, ApprovalLog.expense_id == Expense.id)
        .where(Expense.company_id == current_user.company_id)
        .order_by(ApprovalLog.timestamp.desc())
    ).all()
    events = session.exec(
        select(AuditEvent)
        .where(AuditEvent.company_id == current_user.company_id)
        .order_by(AuditEvent.timestamp.desc())
    ).all()

    items: list[AuditStreamItemResponse] = []
    for expense in expenses:
        owner = session.get(User, expense.user_id)
        items.append(
            AuditStreamItemResponse(
                id=f"expense-{expense.id}",
                event_type="expense_created" if expense.status == "draft" else "expense_submitted",
                expense_id=expense.id,
                expense_description=expense.description,
                actor_id=owner.id if owner else None,
                actor_name=owner.name if owner else "",
                actor_role=owner.role.value if owner else "",
                decision=None,
                message=f"Expense {expense.status}",
                timestamp=expense.submitted_at,
            )
        )

    for log in logs:
        expense = session.get(Expense, log.expense_id)
        approver = session.get(User, log.approver_id)
        if not expense:
            continue
        items.append(
            AuditStreamItemResponse(
                id=f"log-{log.id}",
                event_type="override" if log.decision.startswith("override_") else "approval_decision",
                expense_id=expense.id,
                expense_description=expense.description,
                actor_id=approver.id if approver else None,
                actor_name=approver.name if approver else "",
                actor_role=approver.role.value if approver else "",
                decision=log.decision,
                message=log.comment or "Decision recorded",
                timestamp=log.timestamp,
            )
        )

    for event in events:
        actor = session.get(User, event.actor_id) if event.actor_id else None
        items.append(
            AuditStreamItemResponse(
                id=f"event-{event.id}",
                event_type=event.event_type,
                expense_id=event.entity_id or 0,
                expense_description=event.message or event.entity_type,
                actor_id=event.actor_id,
                actor_name=actor.name if actor else "",
                actor_role=event.actor_role,
                decision=None,
                message=event.message,
                timestamp=event.timestamp,
            )
        )

    items = sorted(items, key=lambda item: item.timestamp, reverse=True)
    return items[:safe_limit]
