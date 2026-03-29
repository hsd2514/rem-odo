from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.database import get_session
from app.deps import get_current_user, require_role
from app.models import ApprovalLog, ApprovalStep, EmployeeManagerMap, Expense, User
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


def _can_view_expense(session: Session, current_user: User, expense: Expense) -> bool:
    return (
        current_user.role.value == "admin"
        or expense.user_id == current_user.id
        or session.exec(
            select(EmployeeManagerMap).where(
                EmployeeManagerMap.employee_id == expense.user_id,
                EmployeeManagerMap.manager_id == current_user.id,
            )
        ).first()
        is not None
    )


@router.post("/{expense_id}/approve", response_model=ExpenseResponse)
def approve_expense(
    expense_id: int,
    payload: ApprovalDecisionRequest,
    session: Session = Depends(get_session),
    _: User = Depends(require_role("manager", "admin")),
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
    _: User = Depends(require_role("manager", "admin")),
    current_user: User = Depends(get_current_user),
) -> ExpenseResponse:
    try:
        expense = apply_decision(session, expense_id, current_user.id, "reject", payload.comment)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return _expense_to_dict(expense)


@router.post("/{expense_id}/override-approve", response_model=ExpenseResponse)
def override_approve(
    expense_id: int,
    payload: ApprovalDecisionRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
) -> ExpenseResponse:
    expense = session.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    expense.status = "approved"
    session.add(expense)
    session.add(
        ApprovalLog(
            expense_id=expense.id,
            approver_id=current_user.id,
            decision="override_approved",
            comment=payload.comment or "Approved by admin override",
        )
    )
    session.commit()
    session.refresh(expense)
    return _expense_to_dict(expense)


@router.post("/{expense_id}/override-reject", response_model=ExpenseResponse)
def override_reject(
    expense_id: int,
    payload: ApprovalDecisionRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_role("admin")),
) -> ExpenseResponse:
    expense = session.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    expense.status = "rejected"
    session.add(expense)
    session.add(
        ApprovalLog(
            expense_id=expense.id,
            approver_id=current_user.id,
            decision="override_rejected",
            comment=payload.comment or "Rejected by admin override",
        )
    )
    session.commit()
    session.refresh(expense)
    return _expense_to_dict(expense)


@router.get("/{expense_id}/logs", response_model=list[ApprovalLogResponse])
def approval_logs(
    expense_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[ApprovalLogResponse]:
    expense = session.get(Expense, expense_id)
    if not expense or expense.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Expense not found")

    can_view = _can_view_expense(session, current_user, expense)
    if not can_view:
        raise HTTPException(status_code=403, detail="Permission denied")

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
def approval_steps(
    expense_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    expense = session.get(Expense, expense_id)
    if not expense or expense.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Expense not found")

    can_view = _can_view_expense(session, current_user, expense)
    if not can_view:
        raise HTTPException(status_code=403, detail="Permission denied")

    return session.exec(select(ApprovalStep).where(ApprovalStep.expense_id == expense_id)).all()
