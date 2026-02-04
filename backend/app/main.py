# Core FastAPI and Imports
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware

# Machine Learning Inference - for risk prediction
from app.ml.inference import predict_risk

# Authentication and Authorization
from app.auth import verify_password, create_access_token, hash_password, get_current_user, require_role

# Database access function
from app.db import (
    init_db,
    get_user_by_username,
    get_user_by_id,
    create_user,

    # Admin - for clinical management
    create_clinician_user,
    list_clinicians,
    update_clinician,
    delete_clinician,

    #Clinician - for patient management
    create_patient,
    get_patient_by_uid,
    search_patients,
    update_patient_by_uid,

    #Assessments
    get_assessment_by_id,
    update_assessment,
    create_assessment,
    list_assessments,
    delete_assessment,
)
# FastAPI app configuration
app = FastAPI(
    title="CardioX API",
    description="Heart attack risk prediction backend",
    version="0.1.0"
)

# Initialising database + creating a default admin user
@app.on_event("startup")
def on_startup():
    init_db()

    admin = get_user_by_username("admin")
    if admin is None:
        create_user("admin", hash_password("admin123"), "admin")

# Enable CORS - for frontend access 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://127.0.0.1", "http://localhost:5500", "http://127.0.0.1:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request schemas

# Login request body
class LoginInput(BaseModel):
    username: str
    password: str

# Admin creates a clinician
class ClinicianCreateInput(BaseModel):
    username: str
    password: str
    first_name: str
    last_name: str

# Admin updates the clinician name
class ClinicianUpdateInput(BaseModel):
    first_name: str
    last_name: str

# Clinician creates / updates patient
class PatientCreateInput(BaseModel):
    first_name: str
    last_name: str
    dob: str
    sex: str

# Clinical asssessment input (Machine Learning features)
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

# Basic health and test endpoints

@app.get("/")
def root():
    return {"message": "CardioX backend is running"}

@app.get("/health")
def health():
    return {"status": "ok"}

# Authentication endpoints

# Login endpoint - this would return the JWT token and role
@app.post("/auth/login")
def login(payload: LoginInput):
    user = get_user_by_username(payload.username)

    # Validating the username and password
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
# Create JWT token with user details
    token = create_access_token({"sub": str(user["id"]), "username": user["username"], "role": user["role"]})
    return {"access_token": token, "token_type": "bearer", "role": user["role"], "username": user["username"]}

# Return the decoded JWT user payload
@app.get("/me")
def me(user=Depends(get_current_user)):
    return user

# Returns full user profile from database 
@app.get("/profile/me")
def profile_me(user=Depends(get_current_user)):
    profile = get_user_by_id(user["id"])
    if profile is None:
        raise HTTPException(status_code=404, detail="User not found")
    return profile

# Admin - clinical management 

@app.post("/admin/clinicians")
def admin_create_clinician(payload: ClinicianCreateInput, admin=Depends(require_role("admin"))):
    if get_user_by_username(payload.username) is not None:
        raise HTTPException(status_code=400, detail="Username already exists")

# Create clinician account (admin only)
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

# Listing all the clinicians
@app.get("/admin/clinicians")
def admin_list_clinicians(admin=Depends(require_role("admin"))):
    return list_clinicians()

# Updating clinician's name 
@app.put("/admin/clinicians/{clinician_id}")
def admin_update_clinician(clinician_id: int, payload: ClinicianUpdateInput, admin=Depends(require_role("admin"))):
    ok = update_clinician(clinician_id, payload.first_name.strip(), payload.last_name.strip())
    if not ok:
        raise HTTPException(status_code=404, detail="Clinician not found")
    return {"updated": True, "id": clinician_id}

# Deleting a clinician
@app.delete("/admin/clinicians/{clinician_id}")
def admin_delete_clinician(clinician_id: int, admin=Depends(require_role("admin"))):
    ok = delete_clinician(clinician_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Clinician not found")
    return {"deleted": True, "id": clinician_id}

# Clinician - Patient Management

# Create a patient
@app.post("/clinician/patients")
def clinician_create_patient(payload: PatientCreateInput, user=Depends(require_role("clinician"))):
    return create_patient(payload.first_name.strip(), payload.last_name.strip(), payload.dob.strip(), payload.sex.strip(), user["id"])

# Search patients by name or ID 
@app.get("/clinician/patients/search")
def clinician_search_patients(patient_uid: str = "", name: str = "", limit: int = 25, user=Depends(require_role("clinician"))):
    return search_patients(patient_uid=patient_uid, name=name, limit=limit)

# Getting a single patient
@app.get("/clinician/patients/{patient_uid}")
def clinician_get_patient(patient_uid: str, user=Depends(require_role("clinician"))):
    patient = get_patient_by_uid(patient_uid)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient

# Updating patient details
@app.put("/clinician/patients/{patient_uid}")
def clinician_update_patient(patient_uid: str, payload: PatientCreateInput, user=Depends(require_role("clinician"))):
    updated = update_patient_by_uid(patient_uid, payload.first_name.strip(), payload.last_name.strip(), payload.dob.strip(), payload.sex.strip())
    if updated is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return updated


# Clinician - assessments

# Create assessment + Machine Learning prediction
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

# List all the patient assessments
@app.get("/clinician/patients/{patient_uid}/assessments")
def clinician_list_assessments(patient_uid: str, limit: int = 50, user=Depends(require_role("clinician"))):
    return list_assessments(patient_uid=patient_uid, clinician_id=user["id"], limit=limit)

# Deleting an assessment
@app.delete("/clinician/assessments/{assessment_id}")
def clinician_delete_assessment(assessment_id: int, user=Depends(require_role("clinician"))):
    ok = delete_assessment(assessment_id, clinician_id=user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return {"deleted": True, "id": assessment_id}

# Get assessment by ID
@app.get("/clinician/assessments/{assessment_id}")
def clinician_get_assessment(assessment_id: int, user=Depends(require_role("clinician"))):
    a = get_assessment_by_id(assessment_id, clinician_id=user["id"])
    if a is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return a

# Updating the assessment + re-running the ML Model
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
