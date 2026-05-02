import pandas as pd

def apply_simulation(forecast_df: pd.DataFrame, sponsor_pct=0.0, transfer_delta=0.0):
    df = forecast_df.copy()
    df["revenue_sim"] = df["revenue"] * (1 + sponsor_pct / 100.0)
    df["expenses_sim"] = df["expenses"] + transfer_delta
    df["net_sim"] = df["revenue_sim"] - df["expenses_sim"]
    return df
