import numpy as np
import pandas as pd


def add_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["performance_score"] = out["goals"] * 4 + out["assists"] * 3
    out["injury_ratio"] = out["injuries_last_season"] / (out["minutes_played"] + 1)
    out["minutes_per_goal"] = out["minutes_played"] / (out["goals"] + 1)
    out["age_factor"] = out["age"].apply(lambda a: 1.15 if a <= 23 else (1.05 if a <= 27 else 0.95))
    return out


def feature_columns():
    return [
        "age",
        "minutes_played",
        "goals",
        "assists",
        "injuries_last_season",
        "performance_score",
        "injury_ratio",
        "minutes_per_goal",
        "age_factor",
    ]
