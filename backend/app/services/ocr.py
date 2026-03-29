from __future__ import annotations

import re
from datetime import datetime

from PIL import Image
import pytesseract

from app.schemas import OCRResult


def run_ocr(file_path: str) -> OCRResult:
    try:
        text = pytesseract.image_to_string(Image.open(file_path))
    except Exception:
        return OCRResult()

    amount = _extract_amount(text)
    date_str = _extract_date(text)
    vendor = _extract_vendor(text)
    vendor_normalized = _normalize_vendor(vendor)
    category_guess = _guess_category(text)
    expense_type = _infer_expense_type(category_guess)
    line_items = _extract_line_items(text)

    return OCRResult(
        amount=amount,
        vendor=vendor,
        vendor_normalized=vendor_normalized,
        expense_date=date_str,
        category_guess=category_guess,
        expense_type=expense_type,
        line_items=line_items,
    )


def _extract_amount(text: str) -> float | None:
    patterns = [
        r'(?:total|amount|grand\s*total|sum|due)[:\s]*[\$€£₹]?\s*([\d,]+\.?\d*)',
        r'[\$€£₹]\s*([\d,]+\.?\d*)',
        r'([\d,]+\.\d{2})',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                return float(match.group(1).replace(",", ""))
            except ValueError:
                continue
    return None


def _extract_date(text: str) -> str | None:
    patterns = [
        r'(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})',
        r'(\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2})',
        r'(\w+\s+\d{1,2},?\s+\d{4})',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return None


def _extract_vendor(text: str) -> str | None:
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    if lines:
        return lines[0][:60]
    return None


def _normalize_vendor(vendor: str | None) -> str | None:
    if not vendor:
        return None
    cleaned = re.sub(r"[^A-Za-z0-9\s&.-]", "", vendor)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned.upper() or None


def _infer_expense_type(category_guess: str | None) -> str | None:
    if not category_guess:
        return None
    mapping = {
        "food": "meal",
        "travel": "transport",
        "lodging": "lodging",
        "office": "office",
        "medical": "medical",
        "entertainment": "entertainment",
        "miscellaneous": "misc",
    }
    key = category_guess.strip().lower()
    return mapping.get(key, key)


def _extract_line_items(text: str) -> list[dict]:
    items: list[dict] = []
    for line in [ln.strip() for ln in text.split("\n") if ln.strip()]:
        match = re.search(r"(.{3,}?)\s+([\d,]+\.?\d{0,2})$", line)
        if not match:
            continue
        description = match.group(1).strip()
        amount_raw = match.group(2).replace(",", "")
        try:
            amount = float(amount_raw)
        except ValueError:
            continue
        if len(description) < 3:
            continue
        items.append({"description": description[:60], "amount": amount})
    return items[:10]


def _guess_category(text: str) -> str:
    lowered = text.lower()
    if any(w in lowered for w in ["uber", "flight", "airline", "taxi", "cab", "travel"]):
        return "Travel"
    if any(w in lowered for w in ["hotel", "lodging", "inn", "resort", "stay"]):
        return "Lodging"
    if any(w in lowered for w in ["restaurant", "food", "meal", "cafe", "coffee", "lunch", "dinner"]):
        return "Food"
    return "Miscellaneous"
