from typing import List, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel, Field

from charts import chart_series
from data import simulate_next_season
from explain import build_explanation
from model import load_or_train, predict_value
from features import add_features


app = FastAPI(title="Player Market Value AI", version="1.0.0")

BUNDLE = load_or_train()


class PlayerInput(BaseModel):
    age: int = Field(..., ge=15, le=45)
    minutes_played: int = Field(..., ge=0)
    goals: int = Field(..., ge=0)
    assists: int = Field(..., ge=0)
    injuries_last_season: int = Field(..., ge=0)
    current_market_value: float = Field(..., ge=0)


class PredictResponse(BaseModel):
    predicted_value: float
    growth_percent: float
    trend: str
    confidence: float
    explanation: str
    chart: List[dict]
    next_season_projection: dict


@app.get("/health")
async def health():
    return {"status": "ok"}


def _trend(growth: float) -> str:
    if growth >= 5:
        return "UP"
    if growth <= -5:
        return "DOWN"
    return "STABLE"


@app.post("/predict-player-value", response_model=PredictResponse)
async def predict_player_value(payload: PlayerInput):
    current = pd.DataFrame([payload.model_dump()])
    future = simulate_next_season(current)

    preds, meta = predict_value(BUNDLE, future)
    predicted_value = float(max(0.0, preds[0]))
    current_value = float(payload.current_market_value)

    growth_percent = 0.0 if current_value <= 0 else ((predicted_value - current_value) / current_value) * 100
    trend = _trend(growth_percent)

    future_features = add_features(future).iloc[0]
    explanation = build_explanation(BUNDLE.model, meta, future_features)

    response = PredictResponse(
        predicted_value=round(predicted_value, 2),
        growth_percent=round(growth_percent, 2),
        trend=trend,
        confidence=round(float(meta.get("confidence", 0.0)), 2),
        explanation=explanation,
        chart=chart_series(current_value, predicted_value, months=12),
        next_season_projection={
            "age": int(future.iloc[0]["age"]),
            "minutes_played": int(future.iloc[0]["minutes_played"]),
            "goals": int(future.iloc[0]["goals"]),
            "assists": int(future.iloc[0]["assists"]),
            "injuries_last_season": int(future.iloc[0]["injuries_last_season"]),
        },
    )
    return response
