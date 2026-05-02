#!/usr/bin/env python3
import json
import math
import sys
from typing import Any, Dict, List


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def to_number(value: Any, fallback: float) -> float:
    try:
        parsed = float(value)
        if math.isfinite(parsed):
            return parsed
    except (TypeError, ValueError):
        pass
    return fallback


def compute_injury_type(inputs: Dict[str, Any]) -> str:
    fatigue = to_number(inputs.get("fatigue"), 0.0)
    load = to_number(inputs.get("load"), 0.0)
    minutes = to_number(inputs.get("minutes"), 0.0)
    history = to_number(inputs.get("history"), 0.0)
    if history >= 8:
        return "Recurring injury"
    if fatigue >= 70 or load >= 70:
        return "Muscle fatigue"
    if minutes >= 75:
        return "Overuse strain"
    return "Minor strain"


def build_rehab(severity: str) -> List[str]:
    if severity == "Severe":
        return [
            "Immediate rest and medical assessment",
            "Structured rehab with physio supervision",
            "Gradual return-to-play protocol",
        ]
    if severity == "Moderate":
        return [
            "Reduce training intensity",
            "Physio-guided mobility and strengthening",
            "Progressive return to full load",
        ]
    return [
        "Rest and active recovery",
        "Light mobility work",
        "Monitor symptoms during training",
    ]


def build_prevention() -> List[str]:
    return [
        "Monitor load and sleep",
        "Daily mobility routine",
        "Progressive return with low impact",
    ]


def compute_result(inputs: Dict[str, Any]) -> Dict[str, Any]:
    age = to_number(inputs.get("age"), 24.0)
    fitness = to_number(inputs.get("fitness"), 75.0)
    history = to_number(inputs.get("history"), 0.0)
    fatigue = to_number(inputs.get("fatigue"), 0.0)
    minutes = to_number(inputs.get("minutes"), 0.0)
    load = to_number(inputs.get("load"), 0.0)
    force_injured = bool(inputs.get("forceInjured"))

    risk = 0.05
    risk += (fatigue / 100.0) * 0.35
    risk += (load / 100.0) * 0.25
    risk += (min(minutes, 90.0) / 90.0) * 0.2
    risk += (min(history, 20.0) / 20.0) * 0.15
    if age >= 30:
        risk += 0.05

    fitness_adjust = (fitness - 50.0) / 100.0
    risk -= fitness_adjust * 0.1
    risk = clamp(risk, 0.02, 0.95)

    injured = force_injured or risk >= 0.45
    injury_type_override = inputs.get("injuryTypeOverride")

    injury_type = None
    severity = None
    recovery_days = 0
    rehab: List[str] = []
    prevention: List[str] = []
    warning = ""

    if injured:
        injury_type = injury_type_override or compute_injury_type(inputs)
        if risk >= 0.75:
            severity = "Severe"
            recovery_days = 21
        elif risk >= 0.6:
            severity = "Moderate"
            recovery_days = 10
        else:
            severity = "Mild"
            recovery_days = 5
        rehab = build_rehab(severity)
        prevention = build_prevention()
        warning = "Player is at elevated injury risk."
    elif risk >= 0.35:
        warning = "Elevated risk due to recent load/fatigue."

    result = {
        "injuryProbability": round(risk, 3),
        "injured": injured,
        "injuryType": injury_type,
        "recoveryDays": recovery_days,
        "severity": severity,
        "rehab": rehab,
        "prevention": prevention,
        "warning": warning,
    }

    player_id = inputs.get("playerId")
    if player_id is not None:
        result["playerId"] = player_id

    return result


def main() -> int:
    if len(sys.argv) < 2:
        sys.stderr.write("Missing JSON payload argument.\n")
        return 1

    payload = sys.argv[1]
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        sys.stderr.write("Invalid JSON payload.\n")
        return 1

    if isinstance(data, list):
        results = [compute_result(item if isinstance(item, dict) else {}) for item in data]
        sys.stdout.write(json.dumps(results))
        return 0

    if isinstance(data, dict):
        result = compute_result(data)
        sys.stdout.write(json.dumps(result))
        return 0

    sys.stderr.write("Unsupported payload type.\n")
    return 1


if __name__ == "__main__":
    sys.exit(main())
