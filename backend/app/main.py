# Core FastAPI and Imports
import re
from io import BytesIO
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr

from app.reporting.pdf_report import build_assessment_pdf

# Machine Learning Inference - for risk prediction
from app.ml.inference import predict_risk, explain_risk, generate_advice

# Authentication and Authorization
from app.auth import (
    verify_password,
    create_access_token,
    hash_password,
    get_current_user,
    require_role,
)

# Database access functions
from app.db import (
    init_db,
    get_user_by_username,
    get_user_by_id,
    create_user,
    get_user_by_email,
    create_pending_clinician_user,

    # Admin - clinician management
    create_clinician_user,
    list_clinicians,
    update_clinician,
    delete_clinician,

    # Admin - full user management
    list_all_users,
    list_pending_users,
    update_user_admin,
    delete_user_admin,
    approve_user_request,
    deny_user_request,

     # Clinician - patient management
    create_patient,
    get_patient_by_uid,
    get_patient_by_uid_for_clinician,
    search_patients,
    update_patient_by_uid,
    delete_patient_by_uid,
    count_assessments_for_patient,


    # Assessments
    get_assessment_by_id,
    update_assessment,
    create_assessment,
    list_assessments,
    delete_assessment,

    # Audit Log
    create_audit_log,
    list_audit_logs,

)

def generate_username(first_name: str, last_name: str) -> str:
    base = f"{first_name.lower()}.{last_name.lower()}"
    username = base
    counter = 1

    while get_user_by_username(username):
        username = f"{base}{counter}"
        counter += 1

    return username

# --------------------------------------------------
# FastAPI app configuration
# --------------------------------------------------

app = FastAPI(
    title="CardioX API",
    description="Heart attack risk prediction backend",
    version="0.1.0"
)

# --------------------------------------------------
# Startup
# --------------------------------------------------

@app.on_event("startup")
def on_startup():
    init_db()

    # Create default admin user if missing
    admin = get_user_by_username("admin")
    if admin is None:
        create_user("admin", hash_password("admin123"), "admin")


# --------------------------------------------------
# CORS
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------
# Request Schemas
# --------------------------------------------------

class LoginInput(BaseModel):
    username: str
    password: str


class SignupRequest(BaseModel):
    first_name: str
    last_name: str

    email: EmailStr
    department: str
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


class AdminUserUpdateInput(BaseModel):
    first_name: str
    last_name: str
    role: str
    department: str


class ApprovalInput(BaseModel):
    role: str


class DenialInput(BaseModel):
    reason: str


# --------------------------------------------------
# Validation Helpers
# --------------------------------------------------

def letters_only_name(value: str, field_name: str) -> str:
    value = (value or "").strip()

    if not value:
        raise HTTPException(status_code=400, detail=f"{field_name} is required.")

    if not re.fullmatch(r"[A-Za-z]+", value):
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} must contain letters only. Please retry."
        )

    return value.capitalize()


def validate_and_format_dob(dob: str) -> str:
    dob = (dob or "").strip()

    if not dob:
        raise HTTPException(status_code=400, detail="DOB is required.")

    # HTML date input sends yyyy-mm-dd
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", dob):
        raise HTTPException(status_code=400, detail="DOB must be a valid date.")

    return dob


def validate_sex(value: str) -> str:
    value = (value or "").strip()
    if value not in {"Male", "Female"}:
        raise HTTPException(status_code=400, detail="Sex must be either Male or Female.")
    return value


def validate_username(value: str) -> str:
    value = (value or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="Username is required.")
    if len(value) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters long.")
    return value


def validate_password(value: str) -> str:
    value = (value or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="Password is required.")
    if len(value) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    if not re.search(r"[A-Z]", value):
        raise HTTPException(status_code=400, detail="Password must contain at least 1 uppercase letter.")
    if not re.search(r"[a-z]", value):
        raise HTTPException(status_code=400, detail="Password must contain at least 1 lowercase letter.")
    if not re.search(r"[^A-Za-z0-9]", value):
        raise HTTPException(status_code=400, detail="Password must contain at least 1 symbol.")
    return value


def validate_role(value: str) -> str:
    value = (value or "").strip()
    allowed = {"admin", "manager", "employee", "it_technician", "clinician"}
    if value not in allowed:
        raise HTTPException(status_code=400, detail="Invalid role selected.")
    return value


# --------------------------------------------------
# Basic Health / Test Endpoints
# --------------------------------------------------

@app.get("/")
def root():
    return {"message": "CardioX backend is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


# --------------------------------------------------
# Authentication Endpoints
# --------------------------------------------------

@app.post("/auth/login")
def login(payload: LoginInput):
    username = validate_username(payload.username)
    user = get_user_by_username(username)

    # Validate username and password
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Clinicians must be approved before they can sign in
    if user["role"] == "clinician" and user.get("approval_status") != "approved":
        raise HTTPException(status_code=403, detail="Your account is awaiting admin approval.")

    token = create_access_token({
        "sub": str(user["id"]),
        "username": user["username"],
        "role": user["role"]
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user["role"],
        "username": user["username"]
    }


@app.post("/auth/signup")
def signup(payload: SignupRequest):
    password = validate_password(payload.password)
    first_name = letters_only_name(payload.first_name, "First name")
    last_name = letters_only_name(payload.last_name, "Last name")
    email = payload.email.strip()
    department = payload.department.strip()

    if get_user_by_email(email) is not None:
        raise HTTPException(status_code=400, detail="Email already exists")

    # Auto-generate username
    username = generate_username(first_name, last_name)

    created = create_pending_clinician_user(
        username=username,
        password_hash=hash_password(password),
        first_name=first_name,
        last_name=last_name,
        email=email,
        department=department,
    )

    return {
        "message": "Signup request submitted successfully.",
        "generated_username": username,   
        "approval_status": created["approval_status"],
    }

@app.get("/me")
def me(user=Depends(get_current_user)):
    return user


@app.get("/profile/me")
def profile_me(user=Depends(get_current_user)):
    profile = get_user_by_id(user["id"])
    if profile is None:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


# --------------------------------------------------
# Admin - Clinician Management
# --------------------------------------------------

@app.post("/admin/clinicians")
def admin_create_clinician(payload: ClinicianCreateInput, admin=Depends(require_role("admin"))):
    username = validate_username(payload.username)
    password = validate_password(payload.password)
    first_name = letters_only_name(payload.first_name, "First name")
    last_name = letters_only_name(payload.last_name, "Last name")

    if get_user_by_username(username) is not None:
        raise HTTPException(status_code=400, detail="Username already exists")

    created = create_clinician_user(
        username=username,
        password_hash=hash_password(password),
        first_name=first_name,
        last_name=last_name,
    )

    return {
        "id": created["id"],
        "username": username,
        "clinician_uid": created["clinician_uid"],
        "first_name": first_name,
        "last_name": last_name,
        "role": "clinician"
    }


@app.get("/admin/clinicians")
def admin_list_clinicians(admin=Depends(require_role("admin"))):
    return list_clinicians()


@app.put("/admin/clinicians/{clinician_id}")
def admin_update_clinician(
    clinician_id: int,
    payload: ClinicianUpdateInput,
    admin=Depends(require_role("admin"))
):
    first_name = letters_only_name(payload.first_name, "First name")
    last_name = letters_only_name(payload.last_name, "Last name")

    ok = update_clinician(clinician_id, first_name, last_name)
    if not ok:
        raise HTTPException(status_code=404, detail="Clinician not found")

    return {"updated": True, "id": clinician_id}


@app.delete("/admin/clinicians/{clinician_id}")
def admin_delete_clinician(clinician_id: int, admin=Depends(require_role("admin"))):
    ok = delete_clinician(clinician_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Clinician not found")
    return {"deleted": True, "id": clinician_id}


# --------------------------------------------------
# Admin - Full User Management
# --------------------------------------------------

@app.get("/admin/users")
def admin_list_users(admin=Depends(require_role("admin"))):
    return list_all_users()


@app.put("/admin/users/{user_id}")
def admin_update_user(
    user_id: int,
    payload: AdminUserUpdateInput,
    admin=Depends(require_role("admin"))
):
    first_name = letters_only_name(payload.first_name, "First name")
    last_name = letters_only_name(payload.last_name, "Last name")
    role = validate_role(payload.role)
    department = payload.department.strip()

    target = get_user_by_id(user_id)
    ok = update_user_admin(user_id, first_name, last_name, role, department)
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")

    create_audit_log(
        actor_user_id=admin["id"],
        action="update_user",
        target_user_id=user_id,
        target_username=target["username"] if target else None,
        details=f"Updated role={role}, department={department}"
    )

    return {"updated": True, "id": user_id}


@app.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: int, admin=Depends(require_role("admin"))):
    target = get_user_by_id(user_id)
    ok = delete_user_admin(user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")

    create_audit_log(
        actor_user_id=admin["id"],
        action="delete_user",
        target_user_id=user_id,
        target_username=target["username"] if target else None,
        details="User deleted from system"
    )

    return {"deleted": True, "id": user_id}


@app.get("/admin/pending-users")
def admin_list_pending_users(admin=Depends(require_role("admin"))):
    return list_pending_users()


@app.post("/admin/pending-users/{user_id}/approve")
def admin_approve_user(
    user_id: int,
    payload: ApprovalInput,
    admin=Depends(require_role("admin"))
):
    role = validate_role(payload.role)

    target = get_user_by_id(user_id)
    ok = approve_user_request(user_id, role)
    if not ok:
        raise HTTPException(status_code=404, detail="Pending user not found")

    create_audit_log(
        actor_user_id=admin["id"],
        action="approve_user",
        target_user_id=user_id,
        target_username=target["username"] if target else None,
        details=f"Approved with role: {role}"
    )

    return {"approved": True, "id": user_id, "role": role}

@app.post("/admin/pending-users/{user_id}/deny")
def admin_deny_user(
    user_id: int,
    payload: DenialInput,
    admin=Depends(require_role("admin"))
):
    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Denial reason is required.")

    target = get_user_by_id(user_id)
    ok = deny_user_request(user_id, reason)
    if not ok:
        raise HTTPException(status_code=404, detail="Pending user not found")

    create_audit_log(
        actor_user_id=admin["id"],
        action="deny_user",
        target_user_id=user_id,
        target_username=target["username"] if target else None,
        details=f"Reason: {reason}"
    )

    return {"denied": True, "id": user_id}

@app.get("/admin/audit-logs")
def admin_list_audit_logs(limit: int = 100, admin=Depends(require_role("admin"))):
    return list_audit_logs(limit=limit)

# --------------------------------------------------
# Clinician - Patient Management
# --------------------------------------------------

@app.post("/clinician/patients")
def clinician_create_patient(payload: PatientCreateInput, user=Depends(require_role("clinician"))):
    first_name = letters_only_name(payload.first_name, "First name")
    last_name = letters_only_name(payload.last_name, "Last name")
    dob = validate_and_format_dob(payload.dob)
    sex = validate_sex(payload.sex)

    return create_patient(first_name, last_name, dob, sex, user["id"])


@app.get("/clinician/patients/search")
def clinician_search_patients(
    patient_uid: str = "",
    name: str = "",
    limit: int = 25,
    user=Depends(require_role("clinician"))
):
    return search_patients(patient_uid=patient_uid, name=name, limit=limit)


@app.get("/clinician/patients/{patient_uid}")
def clinician_get_patient(patient_uid: str, user=Depends(require_role("clinician"))):
    patient = get_patient_by_uid(patient_uid)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@app.put("/clinician/patients/{patient_uid}")
def clinician_update_patient(
    patient_uid: str,
    payload: PatientCreateInput,
    user=Depends(require_role("clinician"))
):
    first_name = letters_only_name(payload.first_name, "First name")
    last_name = letters_only_name(payload.last_name, "Last name")
    dob = validate_and_format_dob(payload.dob)
    sex = validate_sex(payload.sex)

    updated = update_patient_by_uid(patient_uid, first_name, last_name, dob, sex)
    if updated is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return updated

@app.delete("/clinician/patients/{patient_uid}")
def clinician_delete_patient(patient_uid: str, user=Depends(require_role("clinician"))):
    patient = get_patient_by_uid_for_clinician(patient_uid, user["id"])
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    assessment_count = count_assessments_for_patient(patient_uid, user["id"])

    deleted = delete_patient_by_uid(patient_uid, user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Patient not found")

    return {
        "deleted": True,
        "patient_uid": patient_uid,
        "deleted_assessments": assessment_count,
        "message": "Patient and linked assessments deleted successfully."
    }


# --------------------------------------------------
# Clinician - Assessments
# --------------------------------------------------

@app.post("/clinician/patients/{patient_uid}/assessments")
def clinician_create_assessment(
    patient_uid: str,
    payload: PatientInput,
    user=Depends(require_role("clinician"))
):
    if get_patient_by_uid(patient_uid) is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    inputs = payload.model_dump()
    result = predict_risk(inputs)
    xai = explain_risk(inputs, top_k=6)
    advice = generate_advice(inputs, xai["top_factors"])

    saved = create_assessment(
        clinician_id=user["id"],
        patient_uid=patient_uid,
        inputs=inputs,
        risk_percent=result["risk_percent"],
        risk_band=result["risk_band"],
    )

    return {
        "assessment": saved,
        "prediction": result,
        "explainability": xai,
        "advice": advice
    }


@app.get("/clinician/patients/{patient_uid}/assessments")
def clinician_list_assessments(
    patient_uid: str,
    limit: int = 50,
    user=Depends(require_role("clinician"))
):
    return list_assessments(patient_uid=patient_uid, clinician_id=user["id"], limit=limit)


@app.delete("/clinician/assessments/{assessment_id}")
def clinician_delete_assessment(assessment_id: int, user=Depends(require_role("clinician"))):
    ok = delete_assessment(assessment_id, clinician_id=user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return {"deleted": True, "id": assessment_id}


@app.get("/clinician/assessments/{assessment_id}")
def clinician_get_assessment(assessment_id: int, user=Depends(require_role("clinician"))):
    assessment = get_assessment_by_id(assessment_id, clinician_id=user["id"])
    if assessment is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment


@app.put("/clinician/assessments/{assessment_id}")
def clinician_update_assessment(
    assessment_id: int,
    payload: PatientInput,
    user=Depends(require_role("clinician"))
):
    inputs = payload.model_dump()
    result = predict_risk(inputs)
    xai = explain_risk(inputs, top_k=6)
    advice = generate_advice(inputs, xai["top_factors"])

    ok = update_assessment(
        assessment_id=assessment_id,
        clinician_id=user["id"],
        inputs=inputs,
        risk_percent=result["risk_percent"],
        risk_band=result["risk_band"],
    )

    if not ok:
        raise HTTPException(status_code=404, detail="Assessment not found")

    return {
        "updated": True,
        "prediction": result,
        "explainability": xai,
        "advice": advice
    }


@app.get("/clinician/assessments/{assessment_id}/report.pdf")
def clinician_export_assessment_pdf(
    assessment_id: int,
    audience: str = Query("clinician"),
    user=Depends(require_role("clinician"))
):
    assessment = get_assessment_by_id(assessment_id, clinician_id=user["id"])
    if assessment is None:
        raise HTTPException(status_code=404, detail="Assessment not found")

    patient = get_patient_by_uid(assessment["patient_uid"])
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    profile = get_user_by_id(user["id"]) or {}
    clinician_name = (
        f"{profile.get('first_name', '')} {profile.get('last_name', '')}".strip()
        or profile.get("username", "Clinician")
    )

    inputs = {
        "age": assessment.get("age"),
        "sex": assessment.get("sex"),
        "cp": assessment.get("cp"),
        "trestbps": assessment.get("trestbps"),
        "chol": assessment.get("chol"),
        "fbs": assessment.get("fbs"),
        "restecg": assessment.get("restecg"),
        "thalch": assessment.get("thalch"),
        "exang": assessment.get("exang"),
        "oldpeak": assessment.get("oldpeak"),
        "slope": assessment.get("slope"),
        "ca": assessment.get("ca"),
        "thal": assessment.get("thal"),
    }

    xai = explain_risk(inputs, top_k=6)
    advice = generate_advice(inputs, xai.get("top_factors", []))

    audience = (audience or "clinician").strip().lower()
    if audience not in {"patient", "clinician"}:
        raise HTTPException(status_code=400, detail="Invalid audience. Use 'patient' or 'clinician'.")

    pdf_bytes = build_assessment_pdf(
        audience=audience,
        clinician_name=clinician_name,
        patient=patient,
        assessment=assessment,
        explainability=xai,
        advice=advice,
    )

    suffix = "Patient" if audience == "patient" else "Clinician"
    filename = f"CardioX_{suffix}_Report_{assessment.get('patient_uid', 'patient')}_{assessment_id}.pdf"

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )