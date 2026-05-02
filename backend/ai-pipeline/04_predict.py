import joblib
import pandas as pd
from rehab_recommendation_engine import generate_rehab_plan

# ===============================
# Load Models
# ===============================
injury_model = joblib.load("injury_model.pkl")
injury_type_model = joblib.load("injury_type_model.pkl")

try:
    recovery_model = joblib.load("recovery_model.pkl")
except:
    recovery_model = None


# ===============================
# Example Player Input (Extreme Case For Testing)
# ===============================
sample = pd.DataFrame([{
    "age": 34,
    "fitness": 40,
    "fatigue": 95,
    "minutes": 90,
    "load": 95,
    "history": 3
}])


# ===============================
# Injury Probability
# ===============================
prob = injury_model.predict_proba(sample)[0][1]
print("\n=== MEDICAL AI ANALYSIS ===")
print("Injury probability:", round(prob, 3))


# ===============================
# Decision Logic
# ===============================
if prob > 0.2:

    # Predict Injury Type
    injury_type = injury_type_model.predict(sample)[0]
    print("Predicted injury type:", injury_type)

    # Predict Recovery Days
    if recovery_model:
        recovery = recovery_model.predict(sample)[0]
        recovery = round(recovery, 1)
    else:
        recovery = 0

    print("Predicted recovery days:", recovery)

    # Severity Level
    if recovery < 7:
        severity = "Mild"
    elif recovery < 21:
        severity = "Moderate"
    else:
        severity = "Severe"

    print("Severity level:", severity)

    # ===============================
    # Rehabilitation & Prevention AI
    # ===============================
    rehab_plan = generate_rehab_plan(
        injury_type=injury_type,
        recovery_days=recovery,
        severity=severity,
        history=sample["history"].iloc[0]
    )

    print("\n=== Rehabilitation & Prevention Plan ===")
    print("Rehabilitation Exercises:")
    for r in rehab_plan["rehab"]:
        print(" -", r)

    print("\nPrevention Strategy:")
    for p in rehab_plan["prevention"]:
        print(" -", p)

    print("\nRecurrence Warning:", rehab_plan["warning"])

else:
    print("No significant injury risk detected.")