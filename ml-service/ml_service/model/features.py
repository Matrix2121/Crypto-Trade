import pandas as pd
import numpy as np


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add technical indicators to OHLCV dataframe with columns: timestamp, open, high, low, close, volume."""
    out = df.copy()
    close = out["close"]

    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    out["rsi"] = 100 - (100 / (1 + rs))

    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    out["macd"] = ema12 - ema26
    out["macd_signal"] = out["macd"].ewm(span=9, adjust=False).mean()

    out["ema20"] = close.ewm(span=20, adjust=False).mean()
    out["ema50"] = close.ewm(span=50, adjust=False).mean()

    sma20 = close.rolling(20).mean()
    std20 = close.rolling(20).std()
    out["bb_upper"] = sma20 + 2 * std20
    out["bb_lower"] = sma20 - 2 * std20

    typical = (out["high"] + out["low"] + close) / 3
    cum_vol = out["volume"].cumsum().replace(0, np.nan)
    out["vwap"] = (typical * out["volume"]).cumsum() / cum_vol

    out["return_1h"] = close.pct_change()
    out["return_24h"] = close.pct_change(24)
    out["volatility_24h"] = out["return_1h"].rolling(24).std()

    return out.dropna()


FEATURE_COLUMNS = [
    "open", "high", "low", "close", "volume",
    "rsi", "macd", "macd_signal", "ema20", "ema50",
    "bb_upper", "bb_lower", "vwap",
    "return_1h", "return_24h", "volatility_24h",
]
