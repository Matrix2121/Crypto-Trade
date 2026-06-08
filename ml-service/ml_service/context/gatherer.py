from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import httpx

from ml_service.config import settings

ASSET_SEARCH_TERMS = {
    "BTC/USD": "Bitcoin",
    "ETH/USD": "Ethereum",
    "SOL/USD": "Solana",
    "LINK/USD": "Chainlink",
}

COINGECKO_IDS = {
    "BTC/USD": "bitcoin",
    "ETH/USD": "ethereum",
    "SOL/USD": "solana",
    "LINK/USD": "chainlink",
}


def _parse_published_at(raw: str) -> datetime | None:
    if not raw:
        return None
    try:
        normalized = raw.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


async def fetch_fear_greed() -> dict:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get("https://api.alternative.me/fng/?limit=8")
            data = r.json().get("data", [])
            if not data:
                return {"fearGreedIndex": 50, "fearGreedTrend7d": 0}
            current = int(data[0]["value"])
            week_ago = int(data[min(7, len(data) - 1)]["value"])
            return {"fearGreedIndex": current, "fearGreedTrend7d": current - week_ago}
    except Exception:
        return {"fearGreedIndex": 50, "fearGreedTrend7d": 0}


async def fetch_headlines(
    asset: str,
    max_age_hours: int | None = 24,
) -> tuple[list[dict], float | None]:
    base = asset.split("/")[0].lower()
    auth_token = settings.cryptopanic_auth_token or "free"
    cutoff = (
        datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
        if max_age_hours is not None
        else None
    )
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://cryptopanic.com/api/v1/posts/",
                params={
                    "auth_token": auth_token,
                    "currencies": base,
                    "public": "true",
                },
            )
            if r.status_code != 200:
                return [], None
            results = r.json().get("results", [])
    except Exception:
        return [], None

    positive = 0
    negative = 0
    headlines: list[dict] = []
    for post in results:
        published = _parse_published_at(post.get("published_at", ""))
        if cutoff is not None:
            if published is None or published < cutoff:
                continue
        votes = post.get("votes") or {}
        positive += int(votes.get("positive") or 0)
        negative += int(votes.get("negative") or 0)
        headlines.append(
            {
                "title": post.get("title", ""),
                "source": "CryptoPanic",
                "publishedAt": post.get("published_at", ""),
            }
        )
        if len(headlines) >= 5:
            break

    sentiment = None
    if positive + negative > 0:
        sentiment = positive / (positive + negative + 1)
    return headlines, sentiment


def _fetch_google_trends_delta_sync(asset: str) -> float | None:
    term = ASSET_SEARCH_TERMS.get(asset)
    if not term:
        return None
    try:
        from pytrends.request import TrendReq

        pytrends = TrendReq(hl="en-US", tz=0)
        pytrends.build_payload([term], timeframe="today 3-m")
        df = pytrends.interest_over_time()
        if df.empty or term not in df.columns:
            return None
        series = df[term].dropna()
        if len(series) < 14:
            return None
        recent = float(series.iloc[-7:].mean())
        prior = float(series.iloc[-14:-7].mean())
        if prior <= 0:
            return None
        return (recent - prior) / prior
    except Exception:
        return None


async def fetch_google_trends_delta(asset: str) -> float | None:
    return await asyncio.to_thread(_fetch_google_trends_delta_sync, asset)


async def fetch_on_chain_alerts(asset: str, ohlcv_state: dict | None) -> list[str]:
    alerts: list[str] = []
    state = ohlcv_state or {}

    volume_ratio = state.get("volumeRatio24h")
    if volume_ratio is not None and volume_ratio > 2.0:
        alerts.append(f"Volume {volume_ratio:.1f}x above 24h average")

    return_24h = state.get("return24h")
    if return_24h is not None and abs(return_24h) > 0.05:
        direction = "up" if return_24h > 0 else "down"
        alerts.append(f"Large 24h move: {return_24h * 100:.1f}% {direction}")

    coin_id = COINGECKO_IDS.get(asset)
    if not coin_id:
        return alerts

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"https://api.coingecko.com/api/v3/coins/{coin_id}")
            if r.status_code != 200:
                return alerts
            pct = r.json().get("market_data", {}).get("price_change_percentage_24h")
            if pct is not None and abs(pct) > 8:
                alerts.append(f"CoinGecko 24h change: {pct:.1f}%")
    except Exception:
        pass

    return alerts


async def fetch_macro() -> dict:
    btc_dom = 50.0
    dxy_change: float | None = None

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get("https://api.coingecko.com/api/v3/global")
            if r.status_code == 200:
                data = r.json().get("data", {})
                btc_dom = round(data.get("market_cap_percentage", {}).get("btc", 50), 2)
    except Exception:
        pass

    try:
        today = datetime.now(timezone.utc).date()
        yesterday = today - timedelta(days=1)
        async with httpx.AsyncClient(timeout=10) as client:
            r_today = await client.get(
                "https://api.frankfurter.app/latest",
                params={"from": "USD", "to": "EUR"},
            )
            r_yesterday = await client.get(
                f"https://api.frankfurter.app/{yesterday.isoformat()}",
                params={"from": "USD", "to": "EUR"},
            )
            if r_today.status_code == 200 and r_yesterday.status_code == 200:
                rate_today = r_today.json()["rates"]["EUR"]
                rate_yesterday = r_yesterday.json()["rates"]["EUR"]
                if rate_yesterday:
                    dxy_change = -((rate_today - rate_yesterday) / rate_yesterday)
    except Exception:
        pass

    return {
        "btcDominance": btc_dom,
        "dxyChange24h": round(dxy_change, 6) if dxy_change is not None else 0.0,
    }


async def gather_context(
    asset: str,
    ohlcv_state: dict | None = None,
    max_age_hours: int = 24,
) -> dict:
    fg = await fetch_fear_greed()
    headlines, headline_sentiment = await fetch_headlines(asset, max_age_hours=max_age_hours)
    macro = await fetch_macro()
    trends_delta = await fetch_google_trends_delta(asset)
    on_chain = await fetch_on_chain_alerts(asset, ohlcv_state)

    social_score = headline_sentiment
    if social_score is None:
        social_score = fg["fearGreedIndex"] / 100.0

    sources = ["sentiment", "macro"]
    if headlines:
        sources.append("news")
    if trends_delta is not None:
        sources.append("google_trends")
    if on_chain:
        sources.append("on_chain")

    return {
        "asset": asset,
        "fearGreedIndex": fg["fearGreedIndex"],
        "fearGreedTrend7d": fg["fearGreedTrend7d"],
        "headlines": headlines,
        "socialSentimentScore": round(social_score, 4),
        "googleTrendsDelta": round(trends_delta, 4) if trends_delta is not None else 0.0,
        "macro": macro,
        "onChainAlerts": on_chain,
        "ohlcvState": ohlcv_state or {},
        "sourcesUsed": sources,
    }
