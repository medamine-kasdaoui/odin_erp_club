from typing import List, Dict


def chart_series(current_value: float, predicted_value: float, months: int = 12) -> List[Dict]:
    if months < 2:
        months = 2
    step = (predicted_value - current_value) / (months - 1)
    series = []
    for i in range(months):
        series.append({
            "month": i + 1,
            "value": round(current_value + step * i, 2),
        })
    return series
