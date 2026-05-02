import pandas as pd
import numpy as np

np.random.seed(42)

players = pd.read_csv("players.csv")

# Injury types (for injured rows)
INJURY_TYPES = [
    "Hamstring Strain",
    "Ankle Sprain",
    "Knee Ligament",
    "Muscle Fatigue"
]

def injury_probability(age, fatigue, minutes, load, history):
    """
    Probability of being injured (binary).
    Tuned so injuries happen but not too often.
    """
    p = 0.12
    p += 0.002 * max(age - 24, 0)
    p += 0.003 * (fatigue / 10)
    p += 0.002 * (minutes / 10)
    p += 0.003 * (load / 10)
    p += 0.015 * history
    return float(np.clip(p, 0.01, 0.85))

rows = []
N_MATCHES = 4000

for match_id in range(1, N_MATCHES + 1):

    intensity = np.random.choice([0.8, 1.0, 1.2], p=[0.25, 0.5, 0.25])
    selected = players.sample(n=22 if len(players) >= 22 else len(players))

    for _, pl in selected.iterrows():

        minutes = int(np.random.choice([0, 15, 30, 45, 60, 75, 90]))
        training_load = int(np.clip(np.random.normal(60, 15) * intensity, 10, 100))

        fatigue = int(np.clip(
            np.random.normal(40, 20) + minutes * 0.4 + training_load * 0.2,
            0, 100
        ))

        fitness = int(np.clip(
            float(pl["baseFitness"]) - fatigue * 0.3 + np.random.normal(0, 5),
            10, 100
        ))

        history = int(pl["injuryHistory"])
        age = int(pl["age"])

        prob = injury_probability(age, fatigue, minutes, training_load, history)
        injured = int(np.random.rand() < prob)

        if injured:
            # Balanced probabilistic assignment (more variety)
            risk_scores = {
                "Muscle Fatigue": max(0.05, fatigue / 100),
                "Hamstring Strain": max(0.05, (minutes / 100) * (training_load / 100)),
                "Knee Ligament": max(0.05, history / 5),
                "Ankle Sprain": max(0.05, training_load / 100),
            }

            total = sum(risk_scores.values())
            probs = [v / total for v in risk_scores.values()]

            injury_type = np.random.choice(list(risk_scores.keys()), p=probs)

            recovery_days = int(np.clip(
                np.random.normal(10 + fatigue * 0.2 + history * 3, 5),
                3, 60
            ))
        else:
            injury_type = "None"
            recovery_days = 0

        rows.append({
            "age": age,
            "fitness": fitness,
            "fatigue": fatigue,
            "minutes": minutes,
            "load": training_load,
            "history": history,
            "injured": injured,
            "injury_type": injury_type,
            "recovery_days": recovery_days
        })

df = pd.DataFrame(rows)
df.to_csv("training_dataset.csv", index=False)

print("✅ Dataset generated with balanced injury types")
print("Rows:", len(df))
print("\nInjury Distribution:")
print(df["injury_type"].value_counts())