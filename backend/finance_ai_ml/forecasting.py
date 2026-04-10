import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX
from data import ensure_datetime, add_features


def fit_arima(series, order=(1, 1, 1), seasonal_order=(1, 0, 1, 12)):
    model = SARIMAX(series, order=order, seasonal_order=seasonal_order, enforce_stationarity=False, enforce_invertibility=False)
    return model.fit(disp=False)


def build_forecast(df: pd.DataFrame, horizon=12):
    df = ensure_datetime(df)
    df = add_features(df)

    revenue_model = fit_arima(df["revenue"])
    expense_model = fit_arima(df["expenses"])

    revenue_forecast = revenue_model.get_forecast(steps=horizon)
    expense_forecast = expense_model.get_forecast(steps=horizon)

    rev_ci = revenue_forecast.conf_int()
    exp_ci = expense_forecast.conf_int()

    future_index = pd.date_range(df["date"].iloc[-1] + pd.offsets.MonthBegin(1), periods=horizon, freq="MS")

    forecast_df = pd.DataFrame({
        "date": future_index,
        "revenue": revenue_forecast.predicted_mean.values,
        "revenue_lower": rev_ci.iloc[:, 0].values,
        "revenue_upper": rev_ci.iloc[:, 1].values,
        "expenses": expense_forecast.predicted_mean.values,
        "expenses_lower": exp_ci.iloc[:, 0].values,
        "expenses_upper": exp_ci.iloc[:, 1].values,
    })

    forecast_df["net"] = forecast_df["revenue"] - forecast_df["expenses"]

    return forecast_df
