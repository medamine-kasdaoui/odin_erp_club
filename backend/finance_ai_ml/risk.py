import pandas as pd

def build_risk_alerts(forecast_df: pd.DataFrame):
    alerts = []
    for _, row in forecast_df.iterrows():
        if row["expenses"] > row["revenue"]:
            gap = row["expenses"] - row["revenue"]
            ratio = gap / max(row["revenue"], 1)
            if ratio > 0.4:
                level = "high"
            elif ratio > 0.2:
                level = "medium"
            else:
                level = "low"

            alerts.append({
                "date": row["date"].strftime("%Y-%m-%d"),
                "severity": level,
                "gap": round(gap, 2),
                "explanation": f"Expenses exceed revenue by {ratio * 100:.1f}%."
            })
    return alerts
