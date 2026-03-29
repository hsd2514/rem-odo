from __future__ import annotations

from datetime import datetime, timezone

import httpx

COUNTRY_URL = "https://restcountries.com/v3.1/all?fields=name,currencies"
RATES_URL = "https://api.exchangerate-api.com/v4/latest/{base}"


async def get_country_currency(country: str) -> str:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(COUNTRY_URL)
        response.raise_for_status()
        countries = response.json()

    for item in countries:
        common_name = item.get("name", {}).get("common", "")
        if common_name.lower() == country.lower():
            currencies = item.get("currencies", {})
            if currencies:
                return next(iter(currencies.keys()))
    return "USD"


async def convert_currency(amount: float, from_currency: str, to_currency: str) -> float:
    preview = await get_conversion_preview(amount, from_currency, to_currency)
    return preview["converted_amount"]


async def get_conversion_preview(
    amount: float,
    from_currency: str,
    to_currency: str,
) -> dict:
    normalized_amount = round(float(amount or 0), 2)
    from_code = from_currency.upper()
    to_code = to_currency.upper()
    now = datetime.now(timezone.utc)

    if from_code == to_code:
        return {
            "amount": normalized_amount,
            "from_currency": from_code,
            "to_currency": to_code,
            "converted_amount": normalized_amount,
            "rate": 1.0,
            "source": "identity",
            "as_of": now,
            "fallback": False,
            "message": None,
        }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(RATES_URL.format(base=from_code))
            response.raise_for_status()
            payload = response.json()
        rates = payload.get("rates", {})
        rate = rates.get(to_code)
        if rate is None:
            return {
                "amount": normalized_amount,
                "from_currency": from_code,
                "to_currency": to_code,
                "converted_amount": normalized_amount,
                "rate": 1.0,
                "source": "fallback",
                "as_of": now,
                "fallback": True,
                "message": f"Live rate unavailable for {from_code}->{to_code}. Showing 1:1 fallback.",
            }
        numeric_rate = float(rate)
        return {
            "amount": normalized_amount,
            "from_currency": from_code,
            "to_currency": to_code,
            "converted_amount": round(normalized_amount * numeric_rate, 2),
            "rate": round(numeric_rate, 6),
            "source": "exchangerate-api",
            "as_of": now,
            "fallback": False,
            "message": None,
        }
    except Exception:
        return {
            "amount": normalized_amount,
            "from_currency": from_code,
            "to_currency": to_code,
            "converted_amount": normalized_amount,
            "rate": 1.0,
            "source": "fallback",
            "as_of": now,
            "fallback": True,
            "message": "Live exchange API unavailable. Showing 1:1 fallback.",
        }
