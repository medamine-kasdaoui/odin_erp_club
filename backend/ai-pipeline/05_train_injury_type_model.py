import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import joblib

print("Loading dataset...")
df = pd.read_csv("training_dataset.csv")

FEATURES = ["age", "fitness", "fatigue", "minutes", "load", "history"]

print("\n=== DATASET INFO ===")
print(df.info())

print("\n=== Unique injury_type values ===")
print(df["injury_type"].unique())

# Safety cleaning
df["injury_type"] = df["injury_type"].fillna("None")

# ✅ Train injury_type model ONLY for injured rows (and not None)
inj_df = df[(df["injured"] == 1) & (df["injury_type"] != "None")].copy()

print("\n=== TRAINING SET FOR injury_type (injured only) ===")
print("Rows:", len(inj_df))
print(inj_df["injury_type"].value_counts())

if len(inj_df) < 200:
    raise ValueError("Not enough injured samples to train injury type model properly.")

X = inj_df[FEATURES]
y = inj_df["injury_type"]

# Stratify ensures every type appears in train/test
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print("\nTraining injury type model...")

model = RandomForestClassifier(
    n_estimators=400,
    random_state=42,
    class_weight="balanced",
    n_jobs=-1
)

model.fit(X_train, y_train)

pred = model.predict(X_test)

print("\n=== Injury Type Model Report ===")
print(classification_report(y_test, pred))

print("\n=== Confusion Matrix ===")
labels = sorted(y.unique())
cm = confusion_matrix(y_test, pred, labels=labels)
print("Labels:", labels)
print(cm)

joblib.dump(model, "injury_type_model.pkl")
print("\n✅ injury_type_model.pkl saved")