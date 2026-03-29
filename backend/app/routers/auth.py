from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.config import settings
from app.core.security import create_token, hash_password, verify_password
from app.deps import get_current_user
from app.models import Company, EmployeeManagerMap, Role, SessionToken, User
from app.schemas import (
    CountryItem,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
    UserMeResponse,
)
from app.services.currency import get_country_currency
from app.services.email import send_password_reset_email

router = APIRouter()


def _issue_tokens_for_user(session: Session, user: User) -> TokenResponse:
    access_token = create_token(str(user.id), "access", settings.access_token_exp_minutes)
    refresh_token = create_token(str(user.id), "refresh", settings.refresh_token_exp_minutes)
    session.add(SessionToken(user_id=user.id, refresh_token=refresh_token))
    session.commit()
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role=user.role.value,
        user_id=user.id,
        user_name=user.name,
    )


@router.post("/signup", response_model=TokenResponse)
async def signup(payload: SignupRequest, session: Session = Depends(get_session)) -> TokenResponse:
    existing = session.exec(select(User).where(User.email == payload.email)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    currency = await get_country_currency(payload.country)
    company = Company(name=payload.company_name, country=payload.country, default_currency=currency)
    session.add(company)
    session.commit()
    session.refresh(company)

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=Role.admin,
        company_id=company.id,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    return _issue_tokens_for_user(session, user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, session: Session = Depends(get_session)) -> TokenResponse:
    user = session.exec(select(User).where(User.email == payload.email)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return _issue_tokens_for_user(session, user)


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, session: Session = Depends(get_session)):
    """Send a password reset email. Always returns success to prevent email enumeration."""
    user = session.exec(select(User).where(User.email == payload.email)).first()
    if user:
        reset_token = create_token(str(user.id), "password_reset", settings.password_reset_exp_minutes)
        send_password_reset_email(user.email, user.name, reset_token)
    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, session: Session = Depends(get_session)):
    """Reset the user's password using a valid reset token."""
    from app.core.security import decode_token

    try:
        decoded = decode_token(payload.token)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link") from exc

    if decoded.get("type") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid token type")

    user_id = decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid token")

    user = session.get(User, int(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(payload.new_password)
    session.add(user)
    session.commit()
    return {"message": "Password reset successfully. You can now sign in."}


@router.post("/refresh", response_model=TokenResponse)
def refresh_tokens(payload: RefreshRequest, session: Session = Depends(get_session)) -> TokenResponse:
    from app.core.security import decode_token

    try:
        decoded = decode_token(payload.refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from exc

    if decoded.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token subject")

    token_row = session.exec(
        select(SessionToken).where(SessionToken.refresh_token == payload.refresh_token)
    ).first()
    if not token_row:
        raise HTTPException(status_code=401, detail="Refresh token revoked")

    user = session.get(User, int(user_id))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Rotate refresh token by deleting old one and issuing a new pair.
    session.delete(token_row)
    session.commit()
    return _issue_tokens_for_user(session, user)


@router.post("/logout", status_code=204)
def logout(payload: LogoutRequest, session: Session = Depends(get_session)) -> None:
    token_row = session.exec(
        select(SessionToken).where(SessionToken.refresh_token == payload.refresh_token)
    ).first()
    if token_row:
        session.delete(token_row)
        session.commit()
    return None


@router.get("/me", response_model=UserMeResponse)
def get_me(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> UserMeResponse:
    company = session.get(Company, current_user.company_id)
    return UserMeResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        company_id=current_user.company_id,
        company_name=company.name if company else "",
        company_country=company.country if company else "",
        default_currency=company.default_currency if company else "USD",
    )


@router.get("/countries", response_model=list[CountryItem])
async def list_countries() -> list[CountryItem]:
    import httpx

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get("https://restcountries.com/v3.1/all?fields=name,currencies")
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return [
            CountryItem(name="India", currency="INR"),
            CountryItem(name="United States", currency="USD"),
            CountryItem(name="Germany", currency="EUR"),
            CountryItem(name="United Kingdom", currency="GBP"),
            CountryItem(name="Japan", currency="JPY"),
            CountryItem(name="Australia", currency="AUD"),
            CountryItem(name="Canada", currency="CAD"),
        ]

    results = []
    for item in data:
        name = item.get("name", {}).get("common", "")
        currencies = item.get("currencies", {})
        if name and currencies:
            code = next(iter(currencies.keys()))
            results.append(CountryItem(name=name, currency=code))
    results.sort(key=lambda x: x.name)
    return results
