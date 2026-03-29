from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select

from app.core.database import get_session
from app.deps import get_current_user, require_role
from app.models import (
    ApprovalLog,
    ApprovalStep,
    Company,
    EmployeeManagerMap,
    Expense,
    ExpenseStatus,
    Receipt,
    User,
)
from app.schemas import (
    ApprovalLogResponse,
    ExpenseTimelineResponse,
    ExpenseCreateRequest,
    ExpenseDetailResponse,
    ExpenseResponse,
    OCRResult,
    TimelineEventResponse,
)
from app.services.currency import convert_currency
from app.services.workflow import create_steps_for_expense

router = APIRouter()


def _expense_to_response(expense: Expense, user_name: str = "") -> ExpenseResponse:
    return ExpenseResponse(
        id=expense.id,
        user_id=expense.user_id,
        user_name=user_name,
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
    is_owner = expense.user_id == current_user.id
    is_admin = current_user.role.value == "admin"
    is_manager_of_owner = session.exec(
        select(EmployeeManagerMap).where(
            EmployeeManagerMap.employee_id == expense.user_id,
            EmployeeManagerMap.manager_id == current_user.id,
        )
    ).first() is not None
    return is_owner or is_admin or is_manager_of_owner


@router.post("", response_model=ExpenseResponse)
async def create_expense(
    payload: ExpenseCreateRequest,
    session: Session = Depends(get_session),
    _: User = Depends(require_role("employee")),
    current_user: User = Depends(get_current_user),
) -> ExpenseResponse:
    company = session.get(Company, current_user.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    converted = await convert_currency(payload.amount, payload.currency, company.default_currency)

    expense = Expense(
        user_id=current_user.id,
        company_id=current_user.company_id,
        amount=payload.amount,
        currency=payload.currency.upper(),
        converted_amount=converted,
        base_currency=company.default_currency,
        category=payload.category,
        description=payload.description,
        paid_by=payload.paid_by,
        expense_date=payload.expense_date,
        remarks=payload.remarks,
        status=ExpenseStatus.draft,
    )
    session.add(expense)
    session.commit()
    session.refresh(expense)

    return _expense_to_response(expense, current_user.name)


@router.patch("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: int,
    payload: ExpenseCreateRequest,
    session: Session = Depends(get_session),
    _: User = Depends(require_role("employee")),
    current_user: User = Depends(get_current_user),
) -> ExpenseResponse:
    expense = session.get(Expense, expense_id)
    if not expense or expense.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Expense not found")
    if expense.status != ExpenseStatus.draft:
        raise HTTPException(status_code=400, detail="Can only edit draft expenses")

    company = session.get(Company, current_user.company_id)
    converted = await convert_currency(payload.amount, payload.currency, company.default_currency)

    expense.amount = payload.amount
    expense.currency = payload.currency.upper()
    expense.converted_amount = converted
    expense.base_currency = company.default_currency
    expense.category = payload.category
    expense.description = payload.description
    expense.paid_by = payload.paid_by
    expense.expense_date = payload.expense_date
    expense.remarks = payload.remarks
    session.add(expense)
    session.commit()
    session.refresh(expense)

    return _expense_to_response(expense, current_user.name)


@router.post("/{expense_id}/submit", response_model=ExpenseResponse)
async def submit_expense(
    expense_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_role("employee")),
    current_user: User = Depends(get_current_user),
) -> ExpenseResponse:
    expense = session.get(Expense, expense_id)
    if not expense or expense.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Expense not found")
    if expense.status != ExpenseStatus.draft:
        raise HTTPException(status_code=400, detail="Only draft expenses can be submitted")

    company = session.get(Company, current_user.company_id)
    if company:
        converted = await convert_currency(expense.amount, expense.currency, company.default_currency)
        expense.converted_amount = converted
        expense.base_currency = company.default_currency

    expense.status = ExpenseStatus.pending
    session.add(expense)
    session.commit()
    session.refresh(expense)

    mapping = session.exec(
        select(EmployeeManagerMap).where(EmployeeManagerMap.employee_id == current_user.id)
    ).first()
    create_steps_for_expense(session, expense, mapping.manager_id if mapping else None)
    session.commit()
    session.refresh(expense)

    return _expense_to_response(expense, current_user.name)


@router.post("/upload-receipt", response_model=OCRResult)
async def upload_receipt(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    _: User = Depends(require_role("employee")),
    current_user: User = Depends(get_current_user),
) -> OCRResult:
    from app.services.file_storage import save_upload
    from app.services.ocr import run_ocr

    contents = await file.read()
    file_path = save_upload(contents, file.filename or "receipt.jpg")

    receipt = Receipt(
        file_name=file.filename or "receipt.jpg",
        file_path=file_path,
        mime_type=file.content_type or "image/jpeg",
    )
    session.add(receipt)
    session.commit()
    session.refresh(receipt)

    ocr_result = run_ocr(file_path)

    receipt.ocr_payload = ocr_result.model_dump()
    session.add(receipt)
    session.commit()

    return ocr_result


@router.get("/my", response_model=list[ExpenseResponse])
def my_expenses(
    session: Session = Depends(get_session),
    _: User = Depends(require_role("employee")),
    current_user: User = Depends(get_current_user),
) -> list[ExpenseResponse]:
    expenses = session.exec(select(Expense).where(Expense.user_id == current_user.id)).all()
    return [_expense_to_response(item, current_user.name) for item in expenses]


@router.get("/team", response_model=list[ExpenseResponse])
def team_expenses(
    session: Session = Depends(get_session),
    _: User = Depends(require_role("manager", "admin")),
    current_user: User = Depends(get_current_user),
) -> list[ExpenseResponse]:
    mapped = session.exec(
        select(EmployeeManagerMap).where(EmployeeManagerMap.manager_id == current_user.id)
    ).all()
    employee_ids = [row.employee_id for row in mapped]
    if not employee_ids:
        return []

    expenses = session.exec(select(Expense).where(Expense.user_id.in_(employee_ids))).all()
    result = []
    for item in expenses:
        user = session.get(User, item.user_id)
        result.append(_expense_to_response(item, user.name if user else ""))
    return result


@router.get("/{expense_id}", response_model=ExpenseDetailResponse)
def get_expense_detail(
    expense_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ExpenseDetailResponse:
    expense = session.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    if expense.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Permission denied")

    if not _can_view_expense(session, current_user, expense):
        raise HTTPException(status_code=403, detail="Permission denied")

    user = session.get(User, expense.user_id)
    expense_resp = _expense_to_response(expense, user.name if user else "")

    logs = session.exec(select(ApprovalLog).where(ApprovalLog.expense_id == expense_id)).all()
    log_responses = []
    for log in logs:
        approver = session.get(User, log.approver_id)
        log_responses.append(
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

    receipt = session.exec(select(Receipt).where(Receipt.expense_id == expense_id)).first()

    return ExpenseDetailResponse(
        expense=expense_resp,
        approval_logs=log_responses,
        receipt_url=receipt.file_path if receipt else None,
    )


@router.get("/{expense_id}/timeline", response_model=ExpenseTimelineResponse)
def get_expense_timeline(
    expense_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ExpenseTimelineResponse:
    expense = session.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    if expense.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Permission denied")
    if not _can_view_expense(session, current_user, expense):
        raise HTTPException(status_code=403, detail="Permission denied")

    owner = session.get(User, expense.user_id)
    steps = session.exec(
        select(ApprovalStep).where(ApprovalStep.expense_id == expense.id).order_by(ApprovalStep.sequence_order.asc())
    ).all()
    logs = session.exec(
        select(ApprovalLog).where(ApprovalLog.expense_id == expense.id).order_by(ApprovalLog.timestamp.asc())
    ).all()

    events: list[TimelineEventResponse] = [
        TimelineEventResponse(
            id=f"expense-created-{expense.id}",
            event_type="expense_created",
            actor_id=owner.id if owner else None,
            actor_name=owner.name if owner else "",
            actor_role=owner.role.value if owner else "",
            message="Expense created as draft",
            timestamp=expense.submitted_at,
        )
    ]

    if expense.status != ExpenseStatus.draft:
        events.append(
            TimelineEventResponse(
                id=f"expense-submitted-{expense.id}",
                event_type="expense_submitted",
                actor_id=owner.id if owner else None,
                actor_name=owner.name if owner else "",
                actor_role=owner.role.value if owner else "",
                message="Expense submitted for approval",
                timestamp=expense.submitted_at,
            )
        )

    for step in steps:
        approver = session.get(User, step.approver_id)
        events.append(
            TimelineEventResponse(
                id=f"step-{step.id}",
                event_type="approval_step",
                actor_id=step.approver_id,
                actor_name=approver.name if approver else "",
                actor_role=approver.role.value if approver else "",
                message=f"Step {step.sequence_order} assigned",
                step_order=step.sequence_order,
                timestamp=expense.submitted_at,
            )
        )

    for log in logs:
        approver = session.get(User, log.approver_id)
        is_override = log.decision.startswith("override_")
        events.append(
            TimelineEventResponse(
                id=f"log-{log.id}",
                event_type="override" if is_override else "approval_decision",
                actor_id=log.approver_id,
                actor_name=approver.name if approver else "",
                actor_role=approver.role.value if approver else "",
                decision=log.decision,
                comment=log.comment,
                message="Admin override performed" if is_override else "Approval decision recorded",
                timestamp=log.timestamp,
            )
        )

    events = sorted(events, key=lambda item: item.timestamp)
    return ExpenseTimelineResponse(expense_id=expense.id, status=expense.status, events=events)
