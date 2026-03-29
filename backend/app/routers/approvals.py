from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.database import get_session
from app.deps import get_current_user
from app.models import ApprovalLog, ApprovalStep, User
from app.schemas import ApprovalDecisionRequest, ApprovalLogResponse, ExpenseResponse
from app.services.workflow import apply_decision

router = APIRouter()


def _expense_to_dict(expense) -> ExpenseResponse:
    return ExpenseResponse(
        id=expense.id,
        user_id=expense.user_id,
        amount=expense.amount,
        currency=expense.currency,
        converted_amount=expense.converted_amount,
        base_currency=expense.base_currency,
        category=expense.category,
        description=expense.description,
        paid_by=expense.paid_by,
        expense_date=expense.expense_date,
        remarks=expense.remarks,
        status=expense.status,
        submitted_at=expense.submitted_at,
    )


@router.post("/{expense_id}/approve", response_model=ExpenseResponse)
def approve_expense(
    expense_id: int,
    payload: ApprovalDecisionRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ExpenseResponse:
    try:
        expense = apply_decision(session, expense_id, current_user.id, "approve", payload.comment)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return _expense_to_dict(expense)


@router.post("/{expense_id}/reject", response_model=ExpenseResponse)
def reject_expense(
    expense_id: int,
    payload: ApprovalDecisionRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ExpenseResponse:
    try:
        expense = apply_decision(session, expense_id, current_user.id, "reject", payload.comment)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return _expense_to_dict(expense)


@router.get("/{expense_id}/logs", response_model=list[ApprovalLogResponse])
def approval_logs(
    expense_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
) -> list[ApprovalLogResponse]:
    logs = session.exec(select(ApprovalLog).where(ApprovalLog.expense_id == expense_id)).all()
    result = []
    for log in logs:
        approver = session.get(User, log.approver_id)
        result.append(
            ApprovalLogResponse(
                id=log.id,
                expense_id=log.expense_id,
                approver_id=log.approver_id,
                approver_name=approver.name if approver else "",
                decision=log.decision,
                comment=log.comment,
                timestamp=log.timestamp,
            )
        )
    return result


@router.get("/{expense_id}/steps", response_model=list[ApprovalStep])
def approval_steps(expense_id: int, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return session.exec(select(ApprovalStep).where(ApprovalStep.expense_id == expense_id)).all()
