from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import create_token, hash_password, verify_password
from app.deps import get_current_user
from app.models import Company, EmployeeManagerMap, Role, SessionToken, User
from app.schemas import (
    CountryItem,
    LoginRequest,
    SignupRequest,
    TokenResponse,
    UserMeResponse,
)
from app.services.currency import get_country_currency

router = APIRouter()


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

    access_token = create_token(str(user.id), "access", 30)
    refresh_token = create_token(str(user.id), "refresh", 60 * 24 * 7)
    session.add(SessionToken(user_id=user.id, refresh_token=refresh_token))
    session.commit()
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role=user.role.value,
        user_id=user.id,
        user_name=user.name,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, session: Session = Depends(get_session)) -> TokenResponse:
    user = session.exec(select(User).where(User.email == payload.email)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_token(str(user.id), "access", 30)
    refresh_token = create_token(str(user.id), "refresh", 60 * 24 * 7)
    session.add(SessionToken(user_id=user.id, refresh_token=refresh_token))
    session.commit()
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role=user.role.value,
        user_id=user.id,
        user_name=user.name,
    )


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
