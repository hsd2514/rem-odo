from __future__ import annotations

import re
from datetime import datetime

from PIL import Image
import pytesseract

from app.schemas import OCRResult


def run_ocr(file_path: str) -> OCRResult:
    try:
        img = Image.open(file_path).convert("RGB")
        text = pytesseract.image_to_string(img)
        print(f"\n[OCR] Raw text extracted ({len(text)} chars):\n{text[:500]}\n")
    except Exception as e:
        print(f"[OCR] ERROR running tesseract: {e}")
        return OCRResult()

    amount = _extract_amount(text)
    date_str = _extract_date(text)
    vendor = _extract_vendor(text)
    category_guess = _guess_category(text)

    print(f"[OCR] Parsed → amount={amount}, date={date_str}, vendor={vendor}, category={category_guess}")

    return OCRResult(
        amount=amount,
        vendor=vendor,
        expense_date=date_str,
        category_guess=category_guess,
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


def _guess_category(text: str) -> str:
    lowered = text.lower()
    if any(w in lowered for w in ["uber", "flight", "airline", "taxi", "cab", "travel"]):
        return "Travel"
    if any(w in lowered for w in ["hotel", "lodging", "inn", "resort", "stay"]):
        return "Lodging"
    if any(w in lowered for w in ["restaurant", "food", "meal", "cafe", "coffee", "lunch", "dinner"]):
        return "Food"
    return "Miscellaneous"
