import joblib
import pandas as pd
from pathlib import Path

MODEL_PATH = Path(__file__).resolve().parents[3] / "ml" / "artifacts" / "final_model.joblib"

_model = joblib.load(MODEL_PATH)


def risk_band(risk_percent: float) -> str:
    """Simple prototype bands for UI (not clinical thresholds)."""
    if risk_percent < 30:
        return "Low"
    if risk_percent < 70:
        return "Moderate"
    return "High"

def predict_risk(patient: dict) -> dict:
    """
    patient: dict of raw feature values (same names as dataset columns, excluding target)
    returns: risk percent + band
    """
    # Convert to DataFrame with one row
    X = pd.DataFrame([patient])

    # Predict probability of class 1
    prob = float(_model.predict_proba(X)[:, 1][0])
    risk_percent = prob * 100

    return {
        "risk_percent": round(risk_percent, 2),
        "risk_band": risk_band(risk_percent)
    }

if __name__ == "__main__":
    # Quick test example (edit values if you want)
    example_patient = {
        "age": 63,
        "sex": "Male",
        "cp": "typical angina",
        "trestbps": 145,
        "chol": 233,
        "fbs": "False",
        "restecg": "lv hypertrophy",
        "thalch": 150,
        "exang": "False",
        "oldpeak": 2.3,
        "slope": "downsloping",
        "ca": 0.0,
        "thal": "fixed defect"
    }

    print(predict_risk(example_patient))
