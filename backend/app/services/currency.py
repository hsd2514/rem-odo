from __future__ import annotations

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
    if from_currency.upper() == to_currency.upper():
        return round(amount, 2)

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(RATES_URL.format(base=from_currency.upper()))
        response.raise_for_status()
        payload = response.json()

    rates = payload.get("rates", {})
    rate = rates.get(to_currency.upper())
    if not rate:
        return round(amount, 2)
    return round(amount * float(rate), 2)
