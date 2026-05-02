import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import classification_report, mean_absolute_error
from sklearn.calibration import CalibratedClassifierCV
from imblearn.over_sampling import SMOTE
import joblib

print("Loading dataset...")
df = pd.read_csv("training_dataset.csv")

FEATURES = ["age", "fitness", "fatigue", "minutes", "load", "history"]

# ===============================
# 🔥 INJURY CLASSIFICATION MODEL
# ===============================

X = df[FEATURES]
y = df["injured"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print("Applying SMOTE to balance injured class...")

smote = SMOTE(random_state=42)
X_train_balanced, y_train_balanced = smote.fit_resample(X_train, y_train)

print("Training injury model...")

base_clf = RandomForestClassifier(
    n_estimators=400,
    max_depth=None,
    random_state=42,
    n_jobs=-1
)

base_clf.fit(X_train_balanced, y_train_balanced)

# 🔥 Calibrate probabilities (important for risk %)
clf = CalibratedClassifierCV(base_clf, method='sigmoid', cv=3)
clf.fit(X_train_balanced, y_train_balanced)

pred = clf.predict(X_test)

print("\n=== Injury Model Report ===")
print(classification_report(y_test, pred))

joblib.dump(clf, "injury_model.pkl")
print("✅ injury_model.pkl saved")


# ===============================
# 🔥 RECOVERY REGRESSION MODEL
# ===============================

injured_df = df[df["injured"] == 1]

if len(injured_df) > 50:

    X2 = injured_df[FEATURES]
    y2 = injured_df["recovery_days"]

    X2_train, X2_test, y2_train, y2_test = train_test_split(
        X2, y2, test_size=0.2, random_state=42
    )

    print("\nTraining recovery model...")

    reg = RandomForestRegressor(
        n_estimators=400,
        random_state=42,
        n_jobs=-1
    )

    reg.fit(X2_train, y2_train)

    pred2 = reg.predict(X2_test)

    print("\n=== Recovery Model MAE ===")
    print(mean_absolute_error(y2_test, pred2))

    joblib.dump(reg, "recovery_model.pkl")
    print("✅ recovery_model.pkl saved")

else:
    print("⚠ Not enough injured samples to train recovery model.")