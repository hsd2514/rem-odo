from __future__ import annotations

import secrets
import string

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import hash_password
from app.deps import get_current_user, require_role
from app.models import AuditEvent, EmployeeManagerMap, Role, User
from app.schemas import SendPasswordResponse, UserCreateRequest, UserResponse, UserUpdateRequest

router = APIRouter()


def _get_manager_info(session: Session, user_id: int) -> tuple[int | None, str | None]:
    mapping = session.exec(
        select(EmployeeManagerMap).where(EmployeeManagerMap.employee_id == user_id)
    ).first()
    if not mapping:
        return None, None
    manager = session.get(User, mapping.manager_id)
    return mapping.manager_id, manager.name if manager else None


@router.get("", response_model=list[UserResponse])
def list_users(
    session: Session = Depends(get_session),
    _: User = Depends(require_role("admin", "manager")),
    current_user: User = Depends(get_current_user),
) -> list[UserResponse]:
    users = session.exec(select(User).where(User.company_id == current_user.company_id)).all()
    result = []
    for u in users:
        mgr_id, mgr_name = _get_manager_info(session, u.id)
        result.append(
            UserResponse(
                id=u.id,
                name=u.name,
                email=u.email,
                role=u.role,
                company_id=u.company_id,
                manager_id=mgr_id,
                manager_name=mgr_name,
            )
        )
    return result


@router.post("", response_model=UserResponse)
def create_user(
    payload: UserCreateRequest,
    session: Session = Depends(get_session),
    _: User = Depends(require_role("admin")),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    existing = session.exec(select(User).where(User.email == payload.email)).first()
    if existing:
        raise HTTPException(status_code=409, detail="User already exists")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password("TempPass#123"),
        role=payload.role,
        company_id=current_user.company_id,
        must_change_password=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    if payload.manager_id:
        session.add(EmployeeManagerMap(employee_id=user.id, manager_id=payload.manager_id))
        session.commit()

    mgr_id, mgr_name = _get_manager_info(session, user.id)
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        company_id=user.company_id,
        manager_id=mgr_id,
        manager_name=mgr_name,
    )


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    session: Session = Depends(get_session),
    _: User = Depends(require_role("admin")),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    user = session.get(User, user_id)
    if not user or user.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.role is not None:
        user.role = payload.role

    if payload.manager_id is not None:
        mapping = session.exec(
            select(EmployeeManagerMap).where(EmployeeManagerMap.employee_id == user_id)
        ).first()
        if payload.manager_id:
            if payload.manager_id == user_id:
                raise HTTPException(status_code=400, detail="User cannot manage themselves")
            manager = session.get(User, payload.manager_id)
            if not manager or manager.company_id != current_user.company_id:
                raise HTTPException(status_code=404, detail="Manager not found")
            if not mapping:
                mapping = EmployeeManagerMap(employee_id=user_id, manager_id=payload.manager_id)
            else:
                mapping.manager_id = payload.manager_id
            session.add(mapping)
        elif mapping:
            session.delete(mapping)

    session.add(user)
    session.add(
        AuditEvent(
            company_id=current_user.company_id,
            event_type="user_updated",
            actor_id=current_user.id,
            actor_role=current_user.role.value,
            entity_type="user",
            entity_id=user.id,
            message=f"Updated user {user.email}",
        )
    )
    session.commit()
    session.refresh(user)

    mgr_id, mgr_name = _get_manager_info(session, user.id)
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        company_id=user.company_id,
        manager_id=mgr_id,
        manager_name=mgr_name,
    )


@router.post("/{user_id}/send-password", response_model=SendPasswordResponse)
def send_password(
    user_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_role("admin")),
) -> SendPasswordResponse:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    alphabet = string.ascii_letters + string.digits + "!@#$%"
    new_password = "".join(secrets.choice(alphabet) for _ in range(12))
    user.password_hash = hash_password(new_password)
    user.must_change_password = True
    session.add(user)
    session.commit()

    return SendPasswordResponse(
        password=new_password,
        message=f"New password generated for {user.email}. Share it securely.",
    )
