from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from app.db import init_db, save_prediction, list_predictions


from app.ml.inference import predict_risk

app = FastAPI(
    title="CardioX API",
    description="Heart attack risk prediction backend",
    version="0.1.0"
)
@app.on_event("startup")
def on_startup():
    init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:5500",
        "http://127.0.0.1:5500"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    patient_dict = patient.model_dump()
    result = predict_risk(patient_dict)

    # Save a small summary + prediction
    save_prediction(
        age=patient_dict.get("age"),
        sex=patient_dict.get("sex"),
        cp=patient_dict.get("cp"),
        risk_percent=result["risk_percent"],
        risk_band=result["risk_band"]
    )

    return result

@app.get("/predictions")
def predictions(limit: int = 50):
    return list_predictions(limit=limit)
