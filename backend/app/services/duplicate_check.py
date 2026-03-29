"""
Duplicate receipt detection service.

Strategy:
  1. Compute a SHA-256 hash of the raw file bytes.
  2. Query existing Receipt rows for the same hash that are linked to an
     expense belonging to the same company, submitted within WINDOW_DAYS.
  3. Return structured duplicate info so the caller can warn the user.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlmodel import Session, select

from app.models import Expense, Receipt


WINDOW_DAYS: int = 90  # look-back window for duplicate candidates


def compute_hash(file_bytes: bytes) -> str:
    """Return SHA-256 hex digest of raw file bytes."""
    return hashlib.sha256(file_bytes).hexdigest()


@dataclass
class DuplicateInfo:
    is_duplicate: bool
    duplicate_receipt_id: Optional[int] = None
    duplicate_expense_id: Optional[int] = None
    duplicate_description: Optional[str] = None
    duplicate_amount: Optional[float] = None
    duplicate_currency: Optional[str] = None
    duplicate_date: Optional[str] = None


def check_duplicate(
    session: Session,
    file_hash: str,
    company_id: int,
    user_id: int,
) -> DuplicateInfo:
    """
    Check whether a receipt with the same hash already exists for this
    company within the look-back window.

    Scope is intentionally broad (whole company) so that admin/manager
    can also catch cross-employee duplicates, while still giving the
    uploader a clear, actionable warning.
    """
    if not file_hash:
        return DuplicateInfo(is_duplicate=False)

    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=WINDOW_DAYS)

    # Find receipts with the same hash that are linked to an expense
    existing_receipts = session.exec(
        select(Receipt).where(
            Receipt.file_hash == file_hash,
            Receipt.expense_id.is_not(None),  # type: ignore[attr-defined]
        )
    ).all()

    if not existing_receipts:
        return DuplicateInfo(is_duplicate=False)

    for receipt in existing_receipts:
        expense = session.get(Expense, receipt.expense_id)
        if not expense:
            continue
        if expense.company_id != company_id:
            continue
        # Only flag if within the time window
        submitted = expense.submitted_at
        if submitted.tzinfo is None:
            submitted = submitted.replace(tzinfo=timezone.utc)
        if submitted < cutoff:
            continue

        # Found a valid duplicate candidate
        return DuplicateInfo(
            is_duplicate=True,
            duplicate_receipt_id=receipt.id,
            duplicate_expense_id=expense.id,
            duplicate_description=expense.description,
            duplicate_amount=expense.amount,
            duplicate_currency=expense.currency,
            duplicate_date=expense.expense_date.strftime("%Y-%m-%d"),
        )

    return DuplicateInfo(is_duplicate=False)
