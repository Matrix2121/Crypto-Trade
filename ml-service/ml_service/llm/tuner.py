import asyncio
import json
import logging
import re

import httpx

from ml_service.config import settings

logger = logging.getLogger(__name__)

CONTEXT_JSON_SCHEMA = (
    '{"sentiment_bias":"bearish|bullish|neutral",'
    '"price_direction":"up|down|flat",'
    '"magnitude_estimate_pct":0.03,'
    '"confidence":0.75,'
    '"reasoning":"max 250 chars",'
    '"sources_used":["string"]}'
)
TUNING_JSON_SCHEMA = (
    '{"price_adjustment_pct":-0.05,"ci_expansion":0.15,"reasoning":"max 250 chars"}'
)


def _mock_context_prediction(context_snapshot: dict) -> dict:
    fg = context_snapshot.get("fearGreedIndex", 50)
    bias = "bearish" if fg < 40 else "bullish" if fg > 60 else "neutral"
    direction = "down" if bias == "bearish" else "up" if bias == "bullish" else "flat"
    magnitude = -0.01 if direction == "down" else 0.01 if direction == "up" else 0.0
    headlines = context_snapshot.get("headlines", [])
    headline_note = headlines[0]["title"][:80] if headlines else "No major headlines"
    precedents = context_snapshot.get("similarHistoricalEvents", [])
    precedent_note = ""
    if precedents:
        changes = [
            float(p["actualChangePct24h"])
            for p in precedents
            if p.get("actualChangePct24h") is not None
        ]
        if changes:
            avg_change = sum(changes) / len(changes)
            precedent_note = f" Similar past events moved {avg_change*100:.1f}% on average."

    return {
        "sentimentBias": bias,
        "priceDirection": direction,
        "magnitudeEstimatePct": magnitude,
        "confidence": 0.65,
        "reasoning": f"Fear/Greed at {fg}. {headline_note}.{precedent_note}",
        "sourcesUsed": context_snapshot.get("sourcesUsed", []),
    }


def _mock_tuning(context_snapshot: dict, context_prediction: dict, ml_prediction: dict) -> dict:
    mag = context_prediction.get("magnitudeEstimatePct", 0)
    fg = context_snapshot.get("fearGreedIndex", 50)
    ci_expansion = 0.04 if fg < 35 or fg > 75 else 0.02
    return {
        "priceAdjustmentPct": mag * 0.5,
        "ciExpansion": ci_expansion,
        "reasoning": (
            f"Applied half of context magnitude ({mag*100:.1f}%) to ML forecast; "
            f"widened CI given fear/greed={fg}."
        ),
    }


def _log_llm_exchange(step: str, prompt: str, response: str) -> None:
    if not settings.llm_log_exchanges:
        return
    logger.info(
        "\n========== LLM %s (%s) ==========\n"
        "----- PROMPT -----\n%s\n\n"
        "----- RESPONSE -----\n%s\n"
        "==================================",
        step,
        settings.llm_provider,
        prompt,
        response,
    )


async def _call_anthropic(prompt: str) -> str:
    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic")
    async with httpx.AsyncClient(timeout=90) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        r.raise_for_status()
        data = r.json()
        return data["content"][0]["text"]


async def _call_gemini(prompt: str) -> str:
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY is required when LLM_PROVIDER=gemini")
    model = settings.gemini_model
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    last_error: Exception | None = None
    for attempt in range(1, 5):
        try:
            async with httpx.AsyncClient(timeout=90) as client:
                r = await client.post(
                    url,
                    params={"key": settings.gemini_api_key},
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "temperature": 0.2,
                            "maxOutputTokens": 4096,
                            "responseMimeType": "application/json",
                        },
                    },
                )
                r.raise_for_status()
                data = r.json()
            candidates = data.get("candidates") or []
            if not candidates:
                raise RuntimeError(f"Gemini returned no candidates: {data}")
            candidate = candidates[0]
            finish_reason = candidate.get("finishReason")
            parts = candidate.get("content", {}).get("parts") or []
            if not parts:
                raise RuntimeError(f"Gemini returned empty content: {data}")
            text = parts[0].get("text", "")
            if finish_reason == "MAX_TOKENS":
                logger.warning("Gemini response truncated (MAX_TOKENS): %s", text[:200])
            if not _parse_json(text):
                raise ValueError("Gemini response was not valid JSON")
            return text
        except httpx.HTTPStatusError as exc:
            last_error = exc
            if exc.response.status_code in (429, 503) and attempt < 4:
                wait = 2 ** attempt
                logger.warning(
                    "Gemini %s (attempt %s/4), retrying in %ss",
                    exc.response.status_code,
                    attempt,
                    wait,
                )
                await asyncio.sleep(wait)
                continue
            raise
        except Exception as exc:
            last_error = exc
            if attempt < 4 and "JSON" in str(exc):
                await asyncio.sleep(1)
                continue
            raise
    raise last_error or RuntimeError("Gemini call failed after retries")


async def _call_llm(prompt: str, *, step: str) -> str:
    provider = settings.llm_provider.lower()
    if provider == "anthropic":
        text = await _call_anthropic(prompt)
    elif provider == "gemini":
        text = await _call_gemini(prompt)
    else:
        raise ValueError(f"Unsupported LLM_PROVIDER for live calls: {provider}")

    _log_llm_exchange(step, prompt, text)
    if settings.llm_provider.lower() == "gemini":
        await asyncio.sleep(1.5)
    return text


def _normalize_pct(value: float, *, max_abs: float = 0.5) -> float:
    """LLMs often return whole percents (-9.42) instead of decimals (-0.0942)."""
    v = float(value)
    if abs(v) > 1:
        v /= 100.0
    return max(-max_abs, min(max_abs, v))


def _compact_context(context_snapshot: dict) -> dict:
    """Shrink context for LLM prompts — full snapshot is still stored in DB."""
    precedents = context_snapshot.get("similarHistoricalEvents") or []
    compact_precedents = [
        {
            "id": p.get("id"),
            "similarityScore": p.get("similarityScore"),
            "actualChangePct24h": p.get("actualChangePct24h"),
            "conditionsSummary": (p.get("conditionsSummary") or "")[:200],
        }
        for p in precedents[:5]
    ]
    return {
        "asset": context_snapshot.get("asset"),
        "fearGreedIndex": context_snapshot.get("fearGreedIndex"),
        "fearGreedTrend7d": context_snapshot.get("fearGreedTrend7d"),
        "headlines": (context_snapshot.get("headlines") or [])[:3],
        "socialSentimentScore": context_snapshot.get("socialSentimentScore"),
        "googleTrendsDelta": context_snapshot.get("googleTrendsDelta"),
        "macro": context_snapshot.get("macro"),
        "onChainAlerts": context_snapshot.get("onChainAlerts"),
        "ohlcvState": context_snapshot.get("ohlcvState"),
        "sourcesUsed": context_snapshot.get("sourcesUsed"),
        "similarHistoricalEvents": compact_precedents,
    }


def _parse_json(text: str) -> dict:
    text = (text or "").strip()
    if not text:
        return {}
    # Strip markdown fences if present
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            return {}
    return {}


async def context_predict(context_snapshot: dict) -> dict:
    if settings.llm_provider == "mock":
        return _mock_context_prediction(context_snapshot)

    compact = _compact_context(context_snapshot)
    prompt = f"""Analyze crypto market context. Reply with valid JSON only, no markdown.
Keep "reasoning" under 250 characters (1-2 sentences).

Context:
{json.dumps(compact, default=str)}

Return exactly this shape (magnitude_estimate_pct as decimal, e.g. 0.03 = 3%):
{CONTEXT_JSON_SCHEMA}"""
    try:
        raw = await _call_llm(prompt, step="context_predict")
        parsed = _parse_json(raw)
        if not parsed:
            raise ValueError("LLM response did not contain parseable JSON")
        return {
            "sentimentBias": parsed.get("sentiment_bias", "neutral"),
            "priceDirection": parsed.get("price_direction", "flat"),
            "magnitudeEstimatePct": _normalize_pct(parsed.get("magnitude_estimate_pct", 0), max_abs=1.0),
            "confidence": float(parsed.get("confidence", 0.5)),
            "reasoning": parsed.get("reasoning", ""),
            "sourcesUsed": parsed.get("sources_used", []),
        }
    except Exception as exc:
        logger.error("context_predict LLM call failed, falling back to mock: %s", exc)
        return _mock_context_prediction(context_snapshot)


def apply_tuning(ml_prediction: dict, tuning: dict) -> dict:
    price = ml_prediction["price"]
    adj = _normalize_pct(tuning.get("priceAdjustmentPct", 0), max_abs=0.25)
    expansion = _normalize_pct(tuning.get("ciExpansion", 0), max_abs=0.5)
    tuned_price = price * (1 + adj)
    ci_low = ml_prediction["ciLow"] * (1 - expansion)
    ci_high = ml_prediction["ciHigh"] * (1 + expansion)
    return {
        "price": round(tuned_price, 2),
        "ciLow": round(max(ci_low, 0), 2),
        "ciHigh": round(ci_high, 2),
    }


async def tune_ml_output(
    context_snapshot: dict,
    context_prediction: dict,
    ml_prediction: dict,
) -> tuple[dict, dict]:
    if settings.llm_provider == "mock":
        tuning = _mock_tuning(context_snapshot, context_prediction, ml_prediction)
        return apply_tuning(ml_prediction, tuning), tuning

    compact = _compact_context(context_snapshot)
    prompt = f"""Tune the XGBoost forecast using market context. Reply with valid JSON only, no markdown.
Keep "reasoning" under 250 characters (1-2 sentences).

Context:
{json.dumps(compact, default=str)}

Context prediction:
{json.dumps(context_prediction, default=str)}

ML prediction:
{json.dumps(ml_prediction, default=str)}

Return exactly this shape (price_adjustment_pct as decimal, e.g. -0.05 = -5%):
{TUNING_JSON_SCHEMA}"""
    try:
        raw = await _call_llm(prompt, step="tune_ml_output")
        parsed = _parse_json(raw)
        if not parsed:
            raise ValueError("LLM response did not contain parseable JSON")
        tuning = {
            "priceAdjustmentPct": _normalize_pct(parsed.get("price_adjustment_pct", 0), max_abs=0.25),
            "ciExpansion": _normalize_pct(parsed.get("ci_expansion", 0.02), max_abs=0.5),
            "reasoning": parsed.get("reasoning", ""),
        }
    except Exception as exc:
        logger.error("tune_ml_output LLM call failed, falling back to mock: %s", exc)
        tuning = _mock_tuning(context_snapshot, context_prediction, ml_prediction)
    return apply_tuning(ml_prediction, tuning), tuning
