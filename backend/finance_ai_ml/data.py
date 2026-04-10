import numpy as np
import pandas as pd
from datetime import datetime


def generate_sample_dataset(start="2021-01-01", periods=48, seed=42):
    rng = np.random.default_rng(seed)
    dates = pd.date_range(start=start, periods=periods, freq="MS")
    seasonality = 1 + 0.15 * np.sin(np.linspace(0, 6 * np.pi, periods))
    trend = np.linspace(1.0, 1.35, periods)
    revenue_base = 450000 * trend * seasonality
    expense_base = 360000 * trend * (1 + 0.08 * np.cos(np.linspace(0, 4 * np.pi, periods)))

    revenue = revenue_base + rng.normal(0, 25000, size=periods)
    expenses = expense_base + rng.normal(0, 22000, size=periods)

    df = pd.DataFrame({
        "date": dates,
        "revenue": np.maximum(100000, revenue),
        "expenses": np.maximum(90000, expenses),
    })
    return df


def ensure_datetime(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["date"] = pd.to_datetime(out["date"])
    out = out.sort_values("date").reset_index(drop=True)
    return out


def add_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["month"] = out["date"].dt.month
    out["year"] = out["date"].dt.year
    out["net"] = out["revenue"] - out["expenses"]
    out["revenue_ma3"] = out["revenue"].rolling(3, min_periods=1).mean()
    out["expenses_ma3"] = out["expenses"].rolling(3, min_periods=1).mean()
    return out
