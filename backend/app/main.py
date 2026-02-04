from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware

from app.ml.inference import predict_risk
from app.auth import verify_password, create_access_token, hash_password, get_current_user, require_role

from app.db import (
    init_db,
    get_user_by_username,
    get_user_by_id,
    create_user,

    # clinicians admin CRUD
    create_clinician_user,
    list_clinicians,
    update_clinician,
    delete_clinician,

    # patient CRUD
    create_patient,
    get_patient_by_uid,
    search_patients,
    update_patient_by_uid,

    # assessments
    get_assessment_by_id,
    update_assessment,
    create_assessment,
    list_assessments,
    delete_assessment,
)

app = FastAPI(
    title="CardioX API",
    description="Heart attack risk prediction backend",
    version="0.1.0"
)

@app.on_event("startup")
def on_startup():
    init_db()

    admin = get_user_by_username("admin")
    if admin is None:
        create_user("admin", hash_password("admin123"), "admin")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://127.0.0.1", "http://localhost:5500", "http://127.0.0.1:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# These are the Schemas
class LoginInput(BaseModel):
    username: str
    password: str

class ClinicianCreateInput(BaseModel):
    username: str
    password: str
    first_name: str
    last_name: str

class ClinicianUpdateInput(BaseModel):
    first_name: str
    last_name: str

class PatientCreateInput(BaseModel):
    first_name: str
    last_name: str
    dob: str
    sex: str

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


# The Basics
@app.get("/")
def root():
    return {"message": "CardioX backend is running"}

@app.get("/health")
def health():
    return {"status": "ok"}


# ---------- Auth ----------
@app.post("/auth/login")
def login(payload: LoginInput):
    user = get_user_by_username(payload.username)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token({"sub": str(user["id"]), "username": user["username"], "role": user["role"]})
    return {"access_token": token, "token_type": "bearer", "role": user["role"], "username": user["username"]}

@app.get("/me")
def me(user=Depends(get_current_user)):
    return user

@app.get("/profile/me")
def profile_me(user=Depends(get_current_user)):
    profile = get_user_by_id(user["id"])
    if profile is None:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


# ---------- Admin: Clinicians ----------
@app.post("/admin/clinicians")
def admin_create_clinician(payload: ClinicianCreateInput, admin=Depends(require_role("admin"))):
    if get_user_by_username(payload.username) is not None:
        raise HTTPException(status_code=400, detail="Username already exists")

    created = create_clinician_user(
        username=payload.username.strip(),
        password_hash=hash_password(payload.password),
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
    )

    return {
        "id": created["id"],
        "username": payload.username,
        "clinician_uid": created["clinician_uid"],
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "role": "clinician"
    }

@app.get("/admin/clinicians")
def admin_list_clinicians(admin=Depends(require_role("admin"))):
    return list_clinicians()

@app.put("/admin/clinicians/{clinician_id}")
def admin_update_clinician(clinician_id: int, payload: ClinicianUpdateInput, admin=Depends(require_role("admin"))):
    ok = update_clinician(clinician_id, payload.first_name.strip(), payload.last_name.strip())
    if not ok:
        raise HTTPException(status_code=404, detail="Clinician not found")
    return {"updated": True, "id": clinician_id}

@app.delete("/admin/clinicians/{clinician_id}")
def admin_delete_clinician(clinician_id: int, admin=Depends(require_role("admin"))):
    ok = delete_clinician(clinician_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Clinician not found")
    return {"deleted": True, "id": clinician_id}


# ---------- Clinician: Patients ----------
@app.post("/clinician/patients")
def clinician_create_patient(payload: PatientCreateInput, user=Depends(require_role("clinician"))):
    return create_patient(payload.first_name.strip(), payload.last_name.strip(), payload.dob.strip(), payload.sex.strip(), user["id"])

@app.get("/clinician/patients/search")
def clinician_search_patients(patient_uid: str = "", name: str = "", limit: int = 25, user=Depends(require_role("clinician"))):
    return search_patients(patient_uid=patient_uid, name=name, limit=limit)

@app.get("/clinician/patients/{patient_uid}")
def clinician_get_patient(patient_uid: str, user=Depends(require_role("clinician"))):
    patient = get_patient_by_uid(patient_uid)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient

@app.put("/clinician/patients/{patient_uid}")
def clinician_update_patient(patient_uid: str, payload: PatientCreateInput, user=Depends(require_role("clinician"))):
    updated = update_patient_by_uid(patient_uid, payload.first_name.strip(), payload.last_name.strip(), payload.dob.strip(), payload.sex.strip())
    if updated is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return updated


# ---------- Assessments ----------
@app.post("/clinician/patients/{patient_uid}/assessments")
def clinician_create_assessment(patient_uid: str, payload: PatientInput, user=Depends(require_role("clinician"))):
    if get_patient_by_uid(patient_uid) is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    inputs = payload.model_dump()
    result = predict_risk(inputs)

    saved = create_assessment(
        clinician_id=user["id"],
        patient_uid=patient_uid,
        inputs=inputs,
        risk_percent=result["risk_percent"],
        risk_band=result["risk_band"],
    )
    return {"assessment": saved, "prediction": result}

@app.get("/clinician/patients/{patient_uid}/assessments")
def clinician_list_assessments(patient_uid: str, limit: int = 50, user=Depends(require_role("clinician"))):
    return list_assessments(patient_uid=patient_uid, clinician_id=user["id"], limit=limit)

@app.delete("/clinician/assessments/{assessment_id}")
def clinician_delete_assessment(assessment_id: int, user=Depends(require_role("clinician"))):
    ok = delete_assessment(assessment_id, clinician_id=user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return {"deleted": True, "id": assessment_id}

@app.get("/clinician/assessments/{assessment_id}")
def clinician_get_assessment(assessment_id: int, user=Depends(require_role("clinician"))):
    a = get_assessment_by_id(assessment_id, clinician_id=user["id"])
    if a is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return a


@app.put("/clinician/assessments/{assessment_id}")
def clinician_update_assessment(assessment_id: int, payload: PatientInput, user=Depends(require_role("clinician"))):
    inputs = payload.model_dump()
    result = predict_risk(inputs)

    ok = update_assessment(
        assessment_id=assessment_id,
        clinician_id=user["id"],
        inputs=inputs,
        risk_percent=result["risk_percent"],
        risk_band=result["risk_band"],
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Assessment not found")

    return {"updated": True, "prediction": result}
