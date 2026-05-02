import json
import sys
import warnings
from typing import Any, Dict

import joblib
import pandas as pd

from rehab_recommendation_engine import generate_rehab_plan

# ---------------------------------------
# Silence sklearn warnings
# ---------------------------------------
warnings.filterwarnings("ignore")

# ---------------------------------------
# Load models ONCE
# ---------------------------------------
injury_model = joblib.load("injury_model.pkl")
injury_type_model = joblib.load("injury_type_model.pkl")

try:
    recovery_model = joblib.load("recovery_model.pkl")
except Exception:
    recovery_model = None

FEATURES = ["age", "fitness", "fatigue", "minutes", "load", "history"]


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def validate_input(data: Dict[str, Any]) -> Dict[str, float]:
    required = ["age", "fitness", "fatigue", "minutes", "load", "history"]
    for k in required:
        if k not in data:
            raise ValueError(f"Missing field: {k}")

    return {
        "age": _clamp(float(data["age"]), 15, 45),
        "fitness": _clamp(float(data["fitness"]), 0, 100),
        "fatigue": _clamp(float(data["fatigue"]), 0, 100),
        "minutes": _clamp(float(data["minutes"]), 0, 120),
        "load": _clamp(float(data["load"]), 0, 100),
        "history": _clamp(float(data["history"]), 0, 20),
    }


def decision_bucket(prob: float) -> str:
    if prob < 0.25:
        return "SAFE"
    elif prob < 0.40:
        return "WARNING"
    else:
        return "INJURED"


# ---------------------------------------
# 🔥 Medical recovery correction logic
# ---------------------------------------
def adjust_recovery_by_type(injury_type: str, recovery: float, history: float) -> float:

    # Base medical minimums
    if injury_type == "Knee Ligament":
        recovery = max(recovery, 45)

    elif injury_type == "Hamstring Strain":
        recovery = max(recovery, 21)

    elif injury_type == "Ankle Sprain":
        recovery = max(recovery, 14)

    elif injury_type == "Muscle Fatigue":
        recovery = min(max(recovery, 3), 10)

    # Re-injury penalty
    if history >= 4:
        recovery *= 1.15

    return _clamp(recovery, 3, 180)


def analyze_player(data: Dict[str, Any]) -> Dict[str, Any]:
    clean = validate_input(data)
    player_id = None
    if "playerId" in data:
        player_id = str(data["playerId"])
    force_injured = bool(data.get("forceInjured", False))
    injury_type_override = data.get("injuryTypeOverride")

    sample = pd.DataFrame([{
        "age": clean["age"],
        "fitness": clean["fitness"],
        "fatigue": clean["fatigue"],
        "minutes": clean["minutes"],
        "load": clean["load"],
        "history": clean["history"],
    }])[FEATURES]

    prob = float(injury_model.predict_proba(sample)[0][1])
    prob = round(prob, 3)

    bucket = "INJURED" if force_injured else decision_bucket(prob)

    result = {
        "injuryProbability": prob,
        "status": bucket,
        "injured": bucket == "INJURED",
        "injuryType": None,
        "recoveryDays": 0,
        "severity": None,
        "rehab": [],
        "prevention": [],
        "warning": None,
    }

    # -----------------------------
    # Only if truly injured
    # -----------------------------
    if bucket == "INJURED":

        injury_type = injury_type_override or injury_type_model.predict(sample)[0]

        if injury_type in [None, "None", "nan"]:
            injury_type = "Muscle Fatigue"

        result["injuryType"] = str(injury_type)
        if force_injured:
            result["injuryProbability"] = _clamp(max(prob, 0.85), 0.0, 1.0)

        # Predict base recovery
        if recovery_model:
            recovery = float(recovery_model.predict(sample)[0])
        else:
            recovery = 10.0

        # 🔥 Apply medical correction
        recovery = adjust_recovery_by_type(
            injury_type,
            recovery,
            clean["history"]
        )

        recovery = round(recovery, 1)
        result["recoveryDays"] = recovery

        # Severity classification
        if recovery < 10:
            severity = "Mild"
        elif recovery < 30:
            severity = "Moderate"
        else:
            severity = "Severe"

        result["severity"] = severity

        rehab_plan = generate_rehab_plan(
            injury_type=injury_type,
            recovery_days=recovery,
            severity=severity,
            history=int(clean["history"]),
        )

        result["rehab"] = rehab_plan.get("rehab", [])
        result["prevention"] = rehab_plan.get("prevention", [])
        result["warning"] = rehab_plan.get(
            "warning",
            "Monitor recovery progression."
        )

    elif bucket == "WARNING":
        result["prevention"] = [
            "Reduce load next 48h",
            "Add mobility + warm-up protocol",
            "Monitor fatigue & sleep"
        ]
        result["warning"] = "Elevated risk zone."

    if player_id:
        result["playerId"] = player_id

    return result


if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            raise ValueError("Missing JSON argument")

        input_data = json.loads(sys.argv[1])
        if isinstance(input_data, list):
            output = [analyze_player(item) for item in input_data]
        else:
            output = analyze_player(input_data)
        print(json.dumps(output))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)