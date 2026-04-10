from typing import Dict, List

import numpy as np
import pandas as pd

from features import feature_columns


def _top_features_linear(coefs: np.ndarray, columns: List[str]) -> List[str]:
    order = np.argsort(np.abs(coefs))[::-1]
    return [columns[i] for i in order[:3]]


def _top_features_rf(importances: np.ndarray, columns: List[str]) -> List[str]:
    order = np.argsort(importances)[::-1]
    return [columns[i] for i in order[:3]]


def build_explanation(model, meta: Dict, input_row: pd.Series) -> str:
    columns = meta.get("feature_columns", feature_columns())
    feature_means = meta.get("feature_means", {})

    if hasattr(model, "coef_"):
        top = _top_features_linear(model.coef_, columns)
    elif hasattr(model, "feature_importances_"):
        top = _top_features_rf(model.feature_importances_, columns)
    elif hasattr(model, "named_steps") and "model" in model.named_steps:
        core = model.named_steps["model"]
        if hasattr(core, "coef_"):
            top = _top_features_linear(core.coef_, columns)
        elif hasattr(core, "feature_importances_"):
            top = _top_features_rf(core.feature_importances_, columns)
        else:
            top = columns[:3]
    else:
        top = columns[:3]

    reasons = []
    for feat in top:
        val = float(input_row.get(feat, 0))
        mean = float(feature_means.get(feat, 0))
        if feat == "injury_ratio":
            direction = "low" if val <= mean else "high"
            reasons.append(f"{direction} injury ratio")
        elif feat == "performance_score":
            direction = "strong" if val >= mean else "moderate"
            reasons.append(f"{direction} performance score")
        elif feat == "minutes_per_goal":
            direction = "efficient" if val <= mean else "inefficient"
            reasons.append(f"{direction} minutes per goal")
        elif feat == "age_factor":
            direction = "favorable age profile" if val >= 1.0 else "age-related decline"  # noqa: E501
            reasons.append(direction)
        else:
            direction = "above" if val >= mean else "below"
            reasons.append(f"{feat.replace('_', ' ')} is {direction} average")

    if not reasons:
        return "Prediction based on overall player performance and availability."

    return "Value influenced by " + ", ".join(reasons[:3]) + "."
