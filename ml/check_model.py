import joblib
from pathlib import Path

MODEL_PATH = Path("ml/artifacts/final_model.joblib")
model = joblib.load(MODEL_PATH)

print(model)