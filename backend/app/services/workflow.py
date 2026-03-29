from __future__ import annotations

from sqlmodel import Session, select

from app.models import ApprovalFlow, ApprovalLog, ApprovalStep, Expense, ExpenseStatus


def _normalized_category(category: str | None) -> str:
    return (category or "").strip().lower()


def _specificity_score(flow: ApprovalFlow) -> int:
    score = 0
    if flow.category:
        score += 1
    if flow.min_amount is not None:
        score += 1
    if flow.max_amount is not None:
        score += 1
    return score


def _matches_flow_conditions(flow: ApprovalFlow, expense: Expense) -> bool:
    if flow.category and _normalized_category(flow.category) != _normalized_category(expense.category):
        return False

    # Use normalized company currency amount when available for consistent thresholds.
    effective_amount = expense.converted_amount if expense.converted_amount > 0 else expense.amount
    if flow.min_amount is not None and effective_amount < flow.min_amount:
        return False
    if flow.max_amount is not None and effective_amount > flow.max_amount:
        return False
    return True


def _flow_sort_key(flow: ApprovalFlow) -> tuple[int, int, int]:
    # Deterministic order:
    # 1) more specific rules first, 2) higher priority first, 3) lower id first.
    flow_id = flow.id or 0
    return (-_specificity_score(flow), -flow.priority, flow_id)


def select_applicable_flow(session: Session, expense: Expense) -> ApprovalFlow | None:
    candidate_flows = session.exec(
        select(ApprovalFlow).where(
            ApprovalFlow.user_id == expense.user_id,
            ApprovalFlow.company_id == expense.company_id,
            ApprovalFlow.is_active == True,  # noqa: E712
        )
    ).all()
    matching = [
        flow
        for flow in candidate_flows
        if flow.is_active and _matches_flow_conditions(flow, expense)
    ]
    if not matching:
        return None
    return sorted(matching, key=_flow_sort_key)[0]


def create_steps_for_expense(session: Session, expense: Expense, manager_id: int | None) -> None:
    flow = select_applicable_flow(session, expense)
    if not flow:
        return

    expense.applied_flow_id = flow.id
    session.add(expense)

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

    flow = None
    if expense.applied_flow_id:
        flow = session.get(ApprovalFlow, expense.applied_flow_id)
    if not flow:
        flow = select_applicable_flow(session, expense)
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

    auto_approvers = set(flow.auto_approve_approvers or [])
    if decision == "approve" and approver_id in auto_approvers:
        for item in steps:
            if item.status == "pending":
                item.status = "skipped"
                session.add(item)
        expense.status = ExpenseStatus.approved
        session.add(step)
        session.add(expense)
        session.commit()
        session.refresh(expense)
        return expense

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
