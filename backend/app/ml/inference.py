# Imports
import joblib
import pandas as pd
from pathlib import Path

# Path to trained Machine Learning Model + navigates up to find the saved model artifact
MODEL_PATH = Path(__file__).resolve().parents[3] / "ml" / "artifacts" / "final_model.joblib"

# Load model once at start up + avoids reloading the model on every prediction
_model = joblib.load(MODEL_PATH)

# Convert numeric risk percentage into a simple risk category + bands are for prototype UI demo
def risk_band(risk_percent: float) -> str:
    """Simple prototype bands for UI (not clinical thresholds)."""
    if risk_percent < 30:
        return "Low"
    if risk_percent < 70:
        return "Moderate"
    return "High"

# Main inference function used by FastAPI backend 
# Parameters - patient (dictionary of clinical feature values)
# Returns - risk_percent (predicted probability of heart attack) + risk_band (Low, Moderate, High Classification)
def predict_risk(patient: dict) -> dict:
    """
    patient: dict of raw feature values (same names as dataset columns, excluding target)
    returns: risk percent + band
    """
  
  # Converting raw patient input into a DataFrame - since the model expects tabular in input
    X = pd.DataFrame([patient])

   # Get probability for the positive class (Class Index 1)
    prob = float(_model.predict_proba(X)[:, 1][0])

    # Convert probability to percentage
    risk_percent = prob * 100

    # Return results UI friendly format
    return {
        "risk_percent": round(risk_percent, 2),
        "risk_band": risk_band(risk_percent)
    }

 #  Allows this file to be run directly to test predictions
if __name__ == "__main__":

# Example patient input - matches model features
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

# Printing the prediction output to console - helpful for debugging
    print(predict_risk(example_patient))
