from __future__ import annotations

import math


def mae(actuals: list[float], preds: list[float]) -> float:
    if not actuals:
        return 0.0
    return sum(abs(a - p) for a, p in zip(actuals, preds)) / len(actuals)


def rmse(actuals: list[float], preds: list[float]) -> float:
    if not actuals:
        return 0.0
    return math.sqrt(sum((a - p) ** 2 for a, p in zip(actuals, preds)) / len(actuals))


def directional_accuracy(actuals: list[float], preds: list[float], bases: list[float]) -> float:
    if not actuals:
        return 0.0
    hits = 0
    for a, p, b in zip(actuals, preds, bases):
        if b == 0:
            continue
        if (a - b) * (p - b) > 0:
            hits += 1
    return hits / len(actuals)


def hit_rate_ci(actuals: list[float], lows: list[float], highs: list[float]) -> float:
    if not actuals:
        return 0.0
    hits = sum(1 for a, lo, hi in zip(actuals, lows, highs) if lo <= a <= hi)
    return hits / len(actuals)
