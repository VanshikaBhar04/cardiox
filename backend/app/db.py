import sqlite3
import secrets
from pathlib import Path
from datetime import datetime
from typing import Optional

DB_PATH = Path(__file__).resolve().parent / "cardiox.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()

    # legacy predictions table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            age INTEGER,
            sex TEXT,
            cp TEXT,
            risk_percent REAL NOT NULL,
            risk_band TEXT NOT NULL
        );
    """)

    # The users table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'clinician'))
        );
    """)

    # Safe migration: clinician fields
    for col_sql in [
        "ALTER TABLE users ADD COLUMN first_name TEXT",
        "ALTER TABLE users ADD COLUMN last_name TEXT",
        "ALTER TABLE users ADD COLUMN clinician_uid TEXT",
    ]:
        try:
            cur.execute(col_sql)
        except sqlite3.OperationalError:
            pass

    # Unique clinician uid
    cur.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clinician_uid
        ON users (clinician_uid)
    """)

    # patients table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            patient_uid TEXT NOT NULL UNIQUE,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            dob TEXT NOT NULL,
            sex TEXT NOT NULL,
            created_by_user_id INTEGER NOT NULL,
            FOREIGN KEY(created_by_user_id) REFERENCES users(id)
        );
    """)

    # assessments table (NEW)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            clinician_id INTEGER NOT NULL,
            patient_uid TEXT NOT NULL,

            age INTEGER,
            sex TEXT,
            cp TEXT,
            trestbps REAL,
            chol REAL,
            fbs TEXT,
            restecg TEXT,
            thalch REAL,
            exang TEXT,
            oldpeak REAL,
            slope TEXT,
            ca REAL,
            thal TEXT,

            risk_percent REAL NOT NULL,
            risk_band TEXT NOT NULL,

            FOREIGN KEY(clinician_id) REFERENCES users(id)
        );
    """)

    conn.commit()
    conn.close()



# The Users

def get_user_by_username(username: str) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE username = ?", (username,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_id(user_id: int) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, username, role, first_name, last_name, clinician_uid FROM users WHERE id = ?",
        (user_id,)
    )
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def create_user(username: str, password_hash: str, role: str) -> int:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO users (created_at, username, password_hash, role) VALUES (?, ?, ?, ?)",
        (datetime.utcnow().isoformat(), username, password_hash, role)
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return new_id


# Clinicians (Admin)

def generate_clinician_uid() -> str:
    date_part = datetime.utcnow().strftime("%Y%m%d")
    rand_part = secrets.token_hex(2).upper()
    return f"CLN-{date_part}-{rand_part}"


def create_clinician_user(username: str, password_hash: str, first_name: str, last_name: str) -> dict:
    """
    Auto-generates clinician_uid and returns {"id": int, "clinician_uid": str}
    """
    conn = get_conn()
    cur = conn.cursor()

    clinician_uid = generate_clinician_uid()
    while True:
        try:
            cur.execute(
                """
                INSERT INTO users (created_at, username, password_hash, role, clinician_uid, first_name, last_name)
                VALUES (?, ?, ?, 'clinician', ?, ?, ?)
                """,
                (datetime.utcnow().isoformat(), username, password_hash, clinician_uid, first_name, last_name)
            )
            conn.commit()
            new_id = cur.lastrowid
            conn.close()
            return {"id": new_id, "clinician_uid": clinician_uid}
        except sqlite3.IntegrityError:
            clinician_uid = generate_clinician_uid()


def list_clinicians() -> list[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, created_at, username, clinician_uid, first_name, last_name, role
        FROM users
        WHERE role='clinician'
        ORDER BY id DESC
    """)
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_clinician(clinician_id: int, first_name: str, last_name: str) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE users
        SET first_name = ?, last_name = ?
        WHERE id = ? AND role='clinician'
        """,
        (first_name, last_name, clinician_id)
    )
    ok = cur.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def delete_clinician(clinician_id: int) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM users WHERE id = ? AND role='clinician'", (clinician_id,))
    ok = cur.rowcount > 0
    conn.commit()
    conn.close()
    return ok



# Patients (Clinician)

def generate_patient_uid() -> str:
    date_part = datetime.utcnow().strftime("%Y%m%d")
    rand_part = secrets.token_hex(2).upper()
    return f"P-{date_part}-{rand_part}"


def create_patient(first_name: str, last_name: str, dob: str, sex: str, created_by_user_id: int) -> dict:
    conn = get_conn()
    cur = conn.cursor()
    patient_uid = generate_patient_uid()

    while True:
        try:
            cur.execute(
                """
                INSERT INTO patients (created_at, patient_uid, first_name, last_name, dob, sex, created_by_user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (datetime.utcnow().isoformat(), patient_uid, first_name, last_name, dob, sex, created_by_user_id)
            )
            conn.commit()
            new_id = cur.lastrowid
            conn.close()
            return {
                "id": new_id,
                "patient_uid": patient_uid,
                "first_name": first_name,
                "last_name": last_name,
                "dob": dob,
                "sex": sex
            }
        except sqlite3.IntegrityError:
            patient_uid = generate_patient_uid()


def get_patient_by_uid(patient_uid: str) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM patients WHERE patient_uid = ?", (patient_uid,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def search_patients(patient_uid: str = "", name: str = "", limit: int = 25) -> list[dict]:
    conn = get_conn()
    cur = conn.cursor()

    patient_uid = (patient_uid or "").strip()
    name = (name or "").strip()

    if patient_uid:
        cur.execute("SELECT * FROM patients WHERE patient_uid = ? ORDER BY id DESC LIMIT ?", (patient_uid, limit))
    elif name:
        q = f"%{name}%"
        cur.execute(
            """
            SELECT * FROM patients
            WHERE first_name LIKE ? OR last_name LIKE ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (q, q, limit)
        )
    else:
        conn.close()
        return []

    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_patient_by_uid(patient_uid: str, first_name: str, last_name: str, dob: str, sex: str) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE patients
        SET first_name = ?, last_name = ?, dob = ?, sex = ?
        WHERE patient_uid = ?
        """,
        (first_name, last_name, dob, sex, patient_uid)
    )
    if cur.rowcount == 0:
        conn.close()
        return None
    conn.commit()
    conn.close()
    return get_patient_by_uid(patient_uid)



# Adding new Assessments

def create_assessment(clinician_id: int, patient_uid: str, inputs: dict, risk_percent: float, risk_band: str) -> dict:
    conn = get_conn()
    cur = conn.cursor()
    created_at = datetime.utcnow().isoformat()

    cur.execute(
        """
        INSERT INTO assessments (
          created_at, clinician_id, patient_uid,
          age, sex, cp, trestbps, chol, fbs, restecg, thalch, exang, oldpeak, slope, ca, thal,
          risk_percent, risk_band
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            created_at, clinician_id, patient_uid,
            inputs.get("age"), inputs.get("sex"), inputs.get("cp"),
            inputs.get("trestbps"), inputs.get("chol"),
            inputs.get("fbs"), inputs.get("restecg"), inputs.get("thalch"),
            inputs.get("exang"), inputs.get("oldpeak"), inputs.get("slope"),
            inputs.get("ca"), inputs.get("thal"),
            risk_percent, risk_band
        )
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return {"id": new_id, "created_at": created_at, "patient_uid": patient_uid, "risk_percent": risk_percent, "risk_band": risk_band}

def get_assessment_by_id(assessment_id: int, clinician_id: int) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM assessments WHERE id = ? AND clinician_id = ?",
        (assessment_id, clinician_id)
    )
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def list_assessments(patient_uid: str, clinician_id: int, limit: int = 50) -> list[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT * FROM assessments
        WHERE patient_uid = ? AND clinician_id = ?
        ORDER BY id DESC
        LIMIT ?
        """,
        (patient_uid, clinician_id, limit)
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_assessment_by_id(assessment_id: int, clinician_id: int) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM assessments WHERE id = ? AND clinician_id = ?",
        (assessment_id, clinician_id)
    )
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def update_assessment(assessment_id: int, clinician_id: int, inputs: dict, risk_percent: float, risk_band: str) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE assessments
        SET age=?, sex=?, cp=?, trestbps=?, chol=?, fbs=?, restecg=?, thalch=?, exang=?, oldpeak=?, slope=?, ca=?, thal=?,
            risk_percent=?, risk_band=?
        WHERE id=? AND clinician_id=?
        """,
        (
            inputs.get("age"), inputs.get("sex"), inputs.get("cp"),
            inputs.get("trestbps"), inputs.get("chol"),
            inputs.get("fbs"), inputs.get("restecg"), inputs.get("thalch"),
            inputs.get("exang"), inputs.get("oldpeak"), inputs.get("slope"),
            inputs.get("ca"), inputs.get("thal"),
            risk_percent, risk_band,
            assessment_id, clinician_id
        )
    )
    ok = cur.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def delete_assessment(assessment_id: int, clinician_id: int) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM assessments WHERE id = ? AND clinician_id = ?", (assessment_id, clinician_id))
    ok = cur.rowcount > 0
    conn.commit()
    conn.close()
    return ok
