import os
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from typing import List, Optional

app = FastAPI(title="Player Value Prediction AI", version="1.0.0")

MODEL_PATH = "player_value_model.pkl"
SCALER_PATH = "player_value_scaler.pkl"

class PlayerStats(BaseModel):
    # Base features
    speed: float
    endurance: float
    distance: float
    dribbles: float
    shots: float
    injuries: int
    heart_rate: float
    age: Optional[int] = 25
    
    # Medical features
    recoveryTime: float
    fitnessLevel: float
    medicalRiskScore: float
    
    # Performance features
    goals: int
    assists: int
    minutesPlayed: int
    ratingPerMatch: float
    consistencyScore: float

def feature_engineering(df: pd.DataFrame):
    # Create new engineered features
    df['injury_frequency'] = df['injuries'] / (df['age'] - 15).clip(lower=1)
    df['goal_contribution'] = (df['goals'] + df['assists']) / (df['minutesPlayed'] / 90.0).clip(lower=1)
    df['health_score'] = (df['fitnessLevel'] - (df['medicalRiskScore'] * 10)).clip(lower=0)
    return df

def train_baseline_model():
    """Generates synthetic data and trains a baseline model if none exists."""
    print("Training baseline model...")
    # Generate synthetic data for training
    n_samples = 100
    data = []
    for _ in range(n_samples):
        age = np.random.randint(17, 35)
        rating = np.random.uniform(6.0, 9.0)
        goals = np.random.randint(0, 30)
        assists = np.random.randint(0, 20)
        injuries = np.random.randint(0, 5)
        
        # Calculate a synthetic value based on some logic
        # Younger + Higher Rating + More Goals - Injuries = Higher Value
        base_val = (rating * 2_000_000) + (goals * 1_500_000) + (assists * 800_000)
        age_factor = 1.2 if age < 23 else 1.0 if age < 29 else 0.7
        injury_penalty = 1 - (injuries * 0.1)
        
        final_value = base_val * age_factor * injury_penalty
        
        data.append({
            'speed': np.random.uniform(60, 95),
            'endurance': np.random.uniform(60, 95),
            'distance': np.random.uniform(5, 12),
            'dribbles': np.random.uniform(10, 50),
            'shots': np.random.uniform(5, 20),
            'injuries': injuries,
            'heart_rate': np.random.uniform(60, 80),
            'age': age,
            'recoveryTime': np.random.uniform(5, 30),
            'fitnessLevel': np.random.uniform(70, 95),
            'medicalRiskScore': np.random.uniform(0, 5),
            'goals': goals,
            'assists': assists,
            'minutesPlayed': np.random.randint(500, 3000),
            'ratingPerMatch': rating,
            'consistencyScore': np.random.uniform(60, 95),
            'market_value': max(500_000, final_value)
        })
    
    df = pd.DataFrame(data)
    y = df.pop('market_value')
    X = feature_engineering(df)
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_scaled, y)
    
    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    print("Baseline model trained and saved.")

# Ensure model exists
if not os.path.exists(MODEL_PATH):
    train_baseline_model()

@app.post("/predict")
@app.post("/predict-player-value")
async def predict_value(stats: PlayerStats):
    try:
        model = joblib.load(MODEL_PATH)
        scaler = joblib.load(SCALER_PATH)
        
        # Convert input to DataFrame
        data_dict = stats.model_dump()
        df = pd.DataFrame([data_dict])
        
        # Apply same feature engineering
        df = feature_engineering(df)
        
        # Scale and predict
        X_scaled = scaler.transform(df)
        prediction = model.predict(X_scaled)[0]
        
        # Calculate next season projection (smooth heuristic).
        # This avoids "next season == predicted" in most normal cases.
        age = stats.age or 25
        growth = 0.0
        growth += (stats.ratingPerMatch - 7.0) * 0.06  # +6% per rating point above 7
        growth += max(0, 23 - age) * 0.01             # +1% per year under 23
        growth -= max(0, age - 29) * 0.01             # -1% per year over 29
        growth -= min(0.08, stats.injuries * 0.02)    # up to -8% injuries penalty
        growth -= min(0.10, (stats.medicalRiskScore / 5) * 0.06 + (stats.recoveryTime / 60) * 0.04)
        growth += min(0.05, (stats.fitnessLevel - 75) / 100 * 0.05)

        # Clamp final seasonal change to reasonable bounds (-15%..+20%)
        growth = max(-0.15, min(0.20, growth))
        growth_multiplier = 1.0 + growth

        next_season_prediction = prediction * growth_multiplier
        
        # Determine key factors (simplified contribution)
        key_factors = []
        explanation = "La valeur est stable."
        
        if stats.ratingPerMatch > 7.5: 
            key_factors.append("Performance constante de haut niveau")
            explanation = "Excellente performance cette saison, ce qui entraîne une hausse de la valeur."
        if stats.age < 23: 
            key_factors.append("Fort potentiel de croissance (jeune âge)")
            explanation += " Le jeune âge du joueur suggère un potentiel de revente élevé."
        if stats.injuries > 2: 
            key_factors.append("Risque médical modéré")
            explanation = "Historique de blessures limitant la progression de la valeur marchande."
        if stats.fitnessLevel > 90: 
            key_factors.append("Condition physique d'élite")

        return {
            "predicted_value": round(float(prediction), 2),
            "next_season_value": round(float(next_season_prediction), 2),
            "confidence_score": 0.85,
            "key_factors": key_factors,
            "explanation": explanation,
            "currency": "EUR"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def health():
    return {"status": "online", "model_version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
