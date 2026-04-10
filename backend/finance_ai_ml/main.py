from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
from data import generate_sample_dataset, ensure_datetime, add_features
from forecasting import build_forecast
from risk import build_risk_alerts
from simulate import apply_simulation

app = FastAPI(title="Finance AI System", version="1.0.0")

class Record(BaseModel):
    date: str
    revenue: float
    expenses: float

class ForecastRequest(BaseModel):
    data: Optional[List[Record]] = None
    horizon: int = 12

class SimulateRequest(BaseModel):
    data: Optional[List[Record]] = None
    horizon: int = 12
    sponsor_pct: float = 0.0
    transfer_delta: float = 0.0


def to_df(records: Optional[List[Record]]):
    if not records:
        df = generate_sample_dataset()
    else:
        df = pd.DataFrame([r.model_dump() for r in records])
    df = ensure_datetime(df)
    return df


def serialize_forecast(df: pd.DataFrame):
    return [
        {
            "date": row["date"].strftime("%Y-%m-%d"),
            "revenue": round(row["revenue"], 2),
            "expenses": round(row["expenses"], 2),
            "net": round(row["net"], 2),
            "revenue_lower": round(row["revenue_lower"], 2),
            "revenue_upper": round(row["revenue_upper"], 2),
            "expenses_lower": round(row["expenses_lower"], 2),
            "expenses_upper": round(row["expenses_upper"], 2),
        }
        for _, row in df.iterrows()
    ]


def serialize_simulation(df: pd.DataFrame):
    return [
        {
            "date": row["date"].strftime("%Y-%m-%d"),
            "revenue": round(row["revenue_sim"], 2),
            "expenses": round(row["expenses_sim"], 2),
            "net": round(row["net_sim"], 2),
        }
        for _, row in df.iterrows()
    ]


@app.post("/forecast")
def forecast(req: ForecastRequest):
    df = to_df(req.data)
    forecast_df = build_forecast(df, horizon=req.horizon)
    response = {
        "forecast": serialize_forecast(forecast_df),
        "chart": {
            "dates": [d.strftime("%Y-%m-%d") for d in forecast_df["date"]],
            "revenue": forecast_df["revenue"].round(2).tolist(),
            "expenses": forecast_df["expenses"].round(2).tolist(),
            "net": forecast_df["net"].round(2).tolist(),
        },
    }
    return response


@app.post("/risk")
def risk(req: ForecastRequest):
    df = to_df(req.data)
    forecast_df = build_forecast(df, horizon=req.horizon)
    alerts = build_risk_alerts(forecast_df)
    return {
        "risk_alerts": alerts,
        "chart": {
            "dates": [d.strftime("%Y-%m-%d") for d in forecast_df["date"]],
            "gap": (forecast_df["expenses"] - forecast_df["revenue"]).round(2).tolist(),
        },
    }


@app.post("/simulate")
def simulate(req: SimulateRequest):
    df = to_df(req.data)
    forecast_df = build_forecast(df, horizon=req.horizon)
    sim_df = apply_simulation(forecast_df, sponsor_pct=req.sponsor_pct, transfer_delta=req.transfer_delta)
    return {
        "simulation_result": serialize_simulation(sim_df),
        "chart": {
            "dates": [d.strftime("%Y-%m-%d") for d in sim_df["date"]],
            "net": sim_df["net_sim"].round(2).tolist(),
        },
    }


@app.get("/sample")
def sample():
    df = generate_sample_dataset()
    df = add_features(df)
    return df.to_dict(orient="records")
