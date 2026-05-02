from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

app = FastAPI(title="Finance ROI Analysis AI", version="1.0.0")

class RoiRequest(BaseModel):
    predictedValue: float
    acquisitionCost: Optional[float] = None
    performanceScore: float

class FinanceRecord(BaseModel):
    date: str
    revenue: float
    expenses: float

class FinanceDataRequest(BaseModel):
    data: Optional[List[FinanceRecord]] = None

@app.post("/roi-analysis")
async def analyze_roi(request: RoiRequest):
    try:
        # Default acquisition cost if not provided (e.g. 80% of current predicted value)
        cost = request.acquisitionCost if request.acquisitionCost else (request.predictedValue * 0.8)
        
        roi_potential = (request.predictedValue - cost) / cost
        
        # Determine recommendation
        if roi_potential > 0.5:
            recommendation = "Strong Buy/Retention - High ROI Potential"
            risk_level = "Low"
        elif roi_potential > 0.1:
            recommendation = "Maintain/Monitor - Moderate ROI"
            risk_level = "Medium"
        else:
            recommendation = "Divest/Re-evaluate - Low or Negative ROI Potential"
            risk_level = "High"
            
        # Factoring in performance score
        if request.performanceScore > 8.0:
            recommendation += " (Backed by elite match performance)"
        elif request.performanceScore < 6.0:
            recommendation += " (Warning: Performance declining)"

        return {
            "roi_score": round(roi_potential * 100, 2),
            "financial_recommendation": recommendation,
            "risk_assessment": risk_level,
            "profit_potential": round(request.predictedValue - cost, 2),
            "cost_utilization": round((cost / request.predictedValue) * 100, 2) if request.predictedValue > 0 else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/forecast")
async def get_forecast(request: FinanceDataRequest):
    try:
        if not request.data or len(request.data) < 2:
            # Return mock forecast if data is insufficient
            return [
                {"date": "2026-05-01", "revenue": 50000, "expenses": 42000, "net": 8000},
                {"date": "2026-06-01", "revenue": 52000, "expenses": 43000, "net": 9000},
                {"date": "2026-07-01", "revenue": 55000, "expenses": 44000, "net": 11000},
            ]
        
        df = pd.DataFrame([r.model_dump() for r in request.data])
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date')
        
        # Simple trend-based forecast (last 3 months average growth)
        last_rev = df['revenue'].iloc[-1]
        last_exp = df['expenses'].iloc[-1]
        
        forecast = []
        last_date = df['date'].iloc[-1]
        
        for i in range(1, 4):
            next_date = last_date + timedelta(days=30 * i)
            # Add 2% growth mock trend
            next_rev = last_rev * (1 + 0.02 * i)
            next_exp = last_exp * (1 + 0.01 * i)
            forecast.append({
                "date": next_date.strftime("%Y-%m-01"),
                "revenue": round(next_rev, 2),
                "expenses": round(next_exp, 2),
                "net": round(next_rev - next_exp, 2)
            })
            
        return forecast
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/risk")
async def get_risk_assessment(request: FinanceDataRequest):
    try:
        if not request.data or len(request.data) == 0:
            return {
                "risk_score": 30,
                "risk_level": "Low",
                "factors": ["Insufficient historical data for deep analysis"],
                "recommendation": "Maintain current spending until more data is available."
            }
            
        df = pd.DataFrame([r.model_dump() for r in request.data])
        total_rev = df['revenue'].sum()
        total_exp = df['expenses'].sum()
        
        burn_rate = total_exp / max(total_rev, 1)
        
        factors = []
        if burn_rate > 0.9:
            risk_score = 75
            risk_level = "High"
            factors.append("Expense ratio is critically high (>90%)")
        elif burn_rate > 0.7:
            risk_score = 50
            risk_level = "Medium"
            factors.append("Moderate expense ratio")
        else:
            risk_score = 20
            risk_level = "Low"
            factors.append("Healthy profit margins")
            
        if len(df) > 3:
            recent_trend = df['revenue'].tail(3).mean() - df['revenue'].head(3).mean()
            if recent_trend < 0:
                risk_score += 10
                factors.append("Slight downward trend in revenue")
                
        return {
            "risk_score": min(risk_score, 100),
            "risk_level": risk_level,
            "factors": factors,
            "recommendation": "Détails de l'analyse basés sur les transactions réelles."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def health():
    return {"status": "online", "service": "finance_ai_ml"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8200)
