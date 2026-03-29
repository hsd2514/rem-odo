from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.database import get_session
from app.deps import get_current_user, require_role
from app.models import ApprovalFlow, User
from app.schemas import ApprovalFlowRequest, ApprovalFlowResponse

router = APIRouter()


def _validate_amount_range(min_amount: float | None, max_amount: float | None) -> None:
    if min_amount is not None and max_amount is not None and min_amount > max_amount:
        raise ValueError("min_amount cannot be greater than max_amount")


def _flow_to_response(flow: ApprovalFlow) -> ApprovalFlowResponse:
    return ApprovalFlowResponse(
        id=flow.id,
        company_id=flow.company_id,
        user_id=flow.user_id,
        description=flow.description,
        category=flow.category,
        min_amount=flow.min_amount,
        max_amount=flow.max_amount,
        priority=flow.priority,
        is_active=flow.is_active,
        manager_first=flow.manager_first,
        sequential=flow.sequential,
        min_approval_percentage=flow.min_approval_percentage,
        approvers=flow.approvers or [],
        required_approvers=flow.required_approvers or [],
    )


@router.post("/create", response_model=ApprovalFlowResponse)
def create_workflow(
    payload: ApprovalFlowRequest,
    session: Session = Depends(get_session),
    _: User = Depends(require_role("admin")),
    current_user: User = Depends(get_current_user),
) -> ApprovalFlowResponse:
    try:
        _validate_amount_range(payload.min_amount, payload.max_amount)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    flow = ApprovalFlow(
        company_id=current_user.company_id,
        user_id=payload.user_id,
        description=payload.description,
        category=payload.category,
        min_amount=payload.min_amount,
        max_amount=payload.max_amount,
        priority=payload.priority,
        is_active=payload.is_active,
        manager_first=payload.manager_first,
        sequential=payload.sequential,
        min_approval_percentage=payload.min_approval_percentage,
        approvers=payload.approvers,
        required_approvers=payload.required_approvers,
    )
    session.add(flow)
    session.commit()
    session.refresh(flow)
    return _flow_to_response(flow)


@router.patch("/update", response_model=ApprovalFlowResponse)
def update_workflow(
    payload: ApprovalFlowRequest,
    session: Session = Depends(get_session),
    _: User = Depends(require_role("admin")),
    current_user: User = Depends(get_current_user),
) -> ApprovalFlowResponse:
    if payload.min_amount is not None and payload.max_amount is not None and payload.min_amount > payload.max_amount:
        raise HTTPException(status_code=400, detail="min_amount cannot be greater than max_amount")

    flow = None
    if payload.id is not None:
        flow = session.exec(
            select(ApprovalFlow).where(
                ApprovalFlow.id == payload.id,
                ApprovalFlow.company_id == current_user.company_id,
            )
        ).first()
    if not flow:
        flow = session.exec(
            select(ApprovalFlow)
            .where(
                ApprovalFlow.user_id == payload.user_id,
                ApprovalFlow.company_id == current_user.company_id,
            )
            .order_by(ApprovalFlow.id.asc())
        ).first()
    if not flow:
        flow = ApprovalFlow(
            company_id=current_user.company_id,
            user_id=payload.user_id,
            description=payload.description,
            category=payload.category,
            min_amount=payload.min_amount,
            max_amount=payload.max_amount,
            priority=payload.priority,
            is_active=payload.is_active,
            manager_first=payload.manager_first,
            sequential=payload.sequential,
            min_approval_percentage=payload.min_approval_percentage,
            approvers=payload.approvers,
            required_approvers=payload.required_approvers,
        )
        session.add(flow)
        session.commit()
        session.refresh(flow)
        return _flow_to_response(flow)

    flow.description = payload.description
    flow.category = payload.category
    flow.min_amount = payload.min_amount
    flow.max_amount = payload.max_amount
    flow.priority = payload.priority
    flow.is_active = payload.is_active
    flow.manager_first = payload.manager_first
    flow.sequential = payload.sequential
    flow.min_approval_percentage = payload.min_approval_percentage
    flow.approvers = payload.approvers
    flow.required_approvers = payload.required_approvers
    session.add(flow)
    session.commit()
    session.refresh(flow)
    return _flow_to_response(flow)


@router.get("/{user_id}", response_model=ApprovalFlowResponse | None)
def get_workflow(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ApprovalFlowResponse | None:
    flow = session.exec(
        select(ApprovalFlow)
        .where(
            ApprovalFlow.user_id == user_id,
            ApprovalFlow.company_id == current_user.company_id,
        )
        .order_by(ApprovalFlow.priority.desc(), ApprovalFlow.id.asc())
    ).first()
    if not flow:
        return None
    return _flow_to_response(flow)


@router.get("/{user_id}/all", response_model=list[ApprovalFlowResponse])
def list_workflows_for_user(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[ApprovalFlowResponse]:
    flows = session.exec(
        select(ApprovalFlow)
        .where(
            ApprovalFlow.user_id == user_id,
            ApprovalFlow.company_id == current_user.company_id,
        )
        .order_by(ApprovalFlow.priority.desc(), ApprovalFlow.id.asc())
    ).all()
    return [_flow_to_response(flow) for flow in flows]
