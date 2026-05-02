import json

def generate_rehab_plan(injury_type, recovery_days, severity, history):
    recommendation = {}
    
    # -----------------------------
    # Hamstring
    # -----------------------------
    if injury_type == "Hamstring Strain":
        recommendation["rehab"] = [
            "Nordic hamstring curls",
            "Eccentric strengthening exercises",
            "Progressive sprint reintroduction",
            "Dynamic flexibility drills"
        ]
        recommendation["prevention"] = [
            "Weekly eccentric hamstring session",
            "Monitor sprint load",
            "Avoid fatigue above 85%"
        ]

    # -----------------------------
    # Knee Ligament
    # -----------------------------
    elif injury_type == "Knee Ligament":
        recommendation["rehab"] = [
            "Closed-chain strength exercises",
            "Quadriceps and hamstring balance work",
            "Stability and proprioception drills",
            "Controlled plyometrics after week 4"
        ]
        recommendation["prevention"] = [
            "Neuromuscular warm-up protocol",
            "Landing mechanics correction",
            "Limit sudden directional overload"
        ]

    # -----------------------------
    # Ankle Sprain
    # -----------------------------
    elif injury_type == "Ankle Sprain":
        recommendation["rehab"] = [
            "Balance board training",
            "Calf strengthening",
            "Ankle mobility drills",
            "Progressive return to cutting movements"
        ]
        recommendation["prevention"] = [
            "Ankle taping during matches",
            "Weekly proprioception drills",
            "Avoid uneven pitch overload"
        ]

    # -----------------------------
    # Muscle Fatigue
    # -----------------------------
    elif injury_type == "Muscle Fatigue":
        recommendation["rehab"] = [
            "Active recovery sessions",
            "Low-intensity cycling",
            "Massage therapy",
            "Sleep optimization protocol"
        ]
        recommendation["prevention"] = [
            "Load monitoring dashboard",
            "Mandatory rest after high-load matches",
            "Hydration optimization"
        ]

    else:
        recommendation["rehab"] = ["No specific rehab required"]
        recommendation["prevention"] = ["Maintain balanced training load"]

    # Add severity modifier
    recommendation["severity_level"] = severity
    recommendation["estimated_recovery_days"] = recovery_days
    
    # Recurrence warning
    if history >= 2:
        recommendation["warning"] = "High recurrence risk. Progressive load monitoring required."
    else:
        recommendation["warning"] = "Normal recurrence risk."

    return recommendation


# -----------------------------
# Test example
# -----------------------------
if __name__ == "__main__":
    test_output = generate_rehab_plan(
        injury_type="Hamstring Strain",
        recovery_days=28,
        severity="Moderate",
        history=2
    )

    print(json.dumps(test_output, indent=4))