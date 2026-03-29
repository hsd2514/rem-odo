from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.database import get_session
from app.deps import get_current_user, require_role
from app.models import ApprovalFlow, User
from app.schemas import ApprovalFlowRequest, ApprovalFlowResponse

router = APIRouter()


def _flow_to_response(flow: ApprovalFlow) -> ApprovalFlowResponse:
    return ApprovalFlowResponse(
        id=flow.id,
        company_id=flow.company_id,
        user_id=flow.user_id,
        description=flow.description,
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
    flow = ApprovalFlow(
        company_id=current_user.company_id,
        user_id=payload.user_id,
        description=payload.description,
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
    flow = session.exec(
        select(ApprovalFlow).where(ApprovalFlow.user_id == payload.user_id)
    ).first()
    if not flow:
        flow = ApprovalFlow(
            company_id=current_user.company_id,
            user_id=payload.user_id,
            description=payload.description,
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
    _: User = Depends(get_current_user),
) -> ApprovalFlowResponse | None:
    flow = session.exec(
        select(ApprovalFlow).where(ApprovalFlow.user_id == user_id)
    ).first()
    if not flow:
        return None
    return _flow_to_response(flow)
