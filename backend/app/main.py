from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

from app.ml.inference import predict_risk

app = FastAPI(
    title="CardioX API",
    description="Heart attack risk prediction backend",
    version="0.1.0"
)

# -------------------------
# Pydantic schema (inputs)
# -------------------------
class PatientInput(BaseModel):
    age: int
    sex: str
    cp: str
    trestbps: Optional[float] = None
    chol: Optional[float] = None
    fbs: str
    restecg: str
    thalch: Optional[float] = None
    exang: str
    oldpeak: Optional[float] = None
    slope: str
    ca: Optional[float] = None
    thal: str


@app.get("/")
def root():
    return {"message": "CardioX backend is running"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/predict")
def predict(patient: PatientInput):
    # Convert Pydantic model -> dict
    patient_dict = patient.model_dump()
    return predict_risk(patient_dict)

