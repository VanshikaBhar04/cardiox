# --------------------------------------------------
# CardioX Model Inference
# --------------------------------------------------

# Loads the trained machine learning model and provides
# a simple prediction interface for cardiovascular risk output.

import joblib
import pandas as pd


# --------------------------------------------------
# Model Loading
# --------------------------------------------------

MODEL_PATH = "artifacts/final_model.joblib"

# Load the trained model once at startup to avoid repeated disk reads
_model = joblib.load(MODEL_PATH)


# --------------------------------------------------
# Risk Classification Helpers
# --------------------------------------------------

def risk_band(risk_percent: float) -> str:
    """
    Converts a predicted risk percentage into a UI-friendly risk band.
    These are prototype display bands and not clinical thresholds.
    """
    if risk_percent < 30:
        return "Low"
    if risk_percent < 60:
        return "Moderate"
    return "High"


# --------------------------------------------------
# Prediction Logic
# --------------------------------------------------

def predict_risk(patient: dict) -> dict:
    """
    Accepts a patient feature dictionary using the same column names
    as the training dataset and returns a risk percentage with a UI band.
    """
    # Convert the raw patient dictionary into a single-row DataFrame
    X = pd.DataFrame([patient])

    # Predict the probability of the positive class
    prob = float(_model.predict_proba(X)[:, 1][0])
    risk_percent = prob * 100

    return {
        "risk_percent": round(risk_percent, 2),
        "risk_band": risk_band(risk_percent),
    }


# --------------------------------------------------
# Local Test Example
# --------------------------------------------------

if __name__ == "__main__":
    # Example patient used for quick local testing of inference output
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
        "thal": "fixed defect",
    }

    print(predict_risk(example_patient))