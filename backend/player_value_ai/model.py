import json
import os
from dataclasses import dataclass
from typing import Dict, Tuple, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from data import generate_players
from features import add_features, feature_columns


ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
MODEL_PATH = os.path.join(ARTIFACT_DIR, "model.joblib")
META_PATH = os.path.join(ARTIFACT_DIR, "metadata.json")


@dataclass
class ModelBundle:
    model: object
    meta: Dict


def _evaluate(y_true, y_pred) -> Dict:
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": rmse,
        "r2": float(r2_score(y_true, y_pred)),
    }


def train_models(df: pd.DataFrame) -> ModelBundle:
    df = add_features(df)
    X = df[feature_columns()]
    y = df["current_market_value"].astype(float)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    lin_model = Pipeline(
        [
            ("scaler", StandardScaler()),
            ("model", LinearRegression()),
        ]
    )
    rf_model = RandomForestRegressor(
        n_estimators=240,
        max_depth=None,
        random_state=42,
        n_jobs=-1,
    )

    lin_model.fit(X_train, y_train)
    rf_model.fit(X_train, y_train)

    lin_pred = lin_model.predict(X_test)
    rf_pred = rf_model.predict(X_test)

    lin_metrics = _evaluate(y_test, lin_pred)
    rf_metrics = _evaluate(y_test, rf_pred)

    if rf_metrics["rmse"] <= lin_metrics["rmse"]:
        best_name = "random_forest"
        best_model = rf_model
        best_metrics = rf_metrics
    else:
        best_name = "linear_regression"
        best_model = lin_model
        best_metrics = lin_metrics

    feature_means = X_train.mean().to_dict()

    confidence = max(0.0, min(1.0, (best_metrics["r2"] + 1) / 2))

    meta = {
        "model": best_name,
        "metrics": best_metrics,
        "feature_means": feature_means,
        "confidence": confidence,
        "feature_columns": feature_columns(),
    }
    return ModelBundle(model=best_model, meta=meta)


def save_bundle(bundle: ModelBundle) -> None:
    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    joblib.dump(bundle.model, MODEL_PATH)
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(bundle.meta, f, indent=2)


def load_bundle() -> Optional[ModelBundle]:
    if not os.path.exists(MODEL_PATH) or not os.path.exists(META_PATH):
        return None
    model = joblib.load(MODEL_PATH)
    with open(META_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)
    return ModelBundle(model=model, meta=meta)


def load_or_train() -> ModelBundle:
    bundle = load_bundle()
    if bundle is not None:
        return bundle
    df = generate_players(1000, seasons=2)
    bundle = train_models(df)
    save_bundle(bundle)
    return bundle


def predict_value(bundle: ModelBundle, df: pd.DataFrame) -> Tuple[np.ndarray, Dict]:
    df = add_features(df)
    X = df[bundle.meta["feature_columns"]]
    preds = bundle.model.predict(X)
    return preds, bundle.meta
