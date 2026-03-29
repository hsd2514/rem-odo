from __future__ import annotations

from sqlmodel import Session, select

from app.models import ApprovalFlow, ApprovalLog, ApprovalStep, Expense, ExpenseStatus


def create_steps_for_expense(session: Session, expense: Expense, manager_id: int | None) -> None:
    flow = session.exec(select(ApprovalFlow).where(ApprovalFlow.user_id == expense.user_id)).first()
    if not flow:
        return

    ordered: list[int] = []
    if flow.manager_first and manager_id:
        ordered.append(manager_id)

    for approver in flow.approvers:
        if approver not in ordered:
            ordered.append(approver)

    for idx, approver_id in enumerate(ordered, start=1):
        step = ApprovalStep(
            expense_id=expense.id,
            approver_id=approver_id,
            sequence_order=idx,
            required=approver_id in flow.required_approvers,
            status="pending",
        )
        session.add(step)


def apply_decision(session: Session, expense_id: int, approver_id: int, decision: str, comment: str) -> Expense:
    expense = session.get(Expense, expense_id)
    if not expense:
        raise ValueError("Expense not found")

    flow = session.exec(select(ApprovalFlow).where(ApprovalFlow.user_id == expense.user_id)).first()
    if not flow:
        raise ValueError("Approval flow not configured")

    steps = session.exec(select(ApprovalStep).where(ApprovalStep.expense_id == expense_id)).all()
    step = next((item for item in steps if item.approver_id == approver_id), None)
    if not step:
        raise ValueError("Approver not in flow")

    if flow.sequential:
        pending = sorted((item for item in steps if item.status == "pending"), key=lambda i: i.sequence_order)
        if pending and pending[0].approver_id != approver_id:
            raise ValueError("Sequential flow: wait for previous approver")

    step.status = "approved" if decision == "approve" else "rejected"
    session.add(
        ApprovalLog(
            expense_id=expense_id,
            approver_id=approver_id,
            decision=step.status,
            comment=comment,
        )
    )

    approved = [item for item in steps if item.status == "approved"]
    rejected = [item for item in steps if item.status == "rejected"]
    required = set(flow.required_approvers)
    approved_ids = {item.approver_id for item in approved}
    rejected_ids = {item.approver_id for item in rejected}

    if required.intersection(rejected_ids):
        expense.status = ExpenseStatus.rejected
    elif required and not required.issubset(approved_ids):
        expense.status = ExpenseStatus.pending
    else:
        pct = int((len(approved) / max(len(steps), 1)) * 100)
        if pct >= flow.min_approval_percentage:
            expense.status = ExpenseStatus.approved
        elif rejected and not flow.sequential:
            expense.status = ExpenseStatus.rejected
        else:
            expense.status = ExpenseStatus.pending

    session.add(step)
    session.add(expense)
    session.commit()
    session.refresh(expense)
    return expense
