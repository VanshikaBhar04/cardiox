import sqlite3
import secrets
from pathlib import Path
from datetime import datetime
from typing import Optional

# Path to the SQLite database file
DB_PATH = Path(__file__).resolve().parent / "cardiox.db"


# --------------------------------------------------
# Database Connection
# --------------------------------------------------

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# --------------------------------------------------
# Database Initialisation
# --------------------------------------------------

def init_db():
    conn = get_conn()
    cur = conn.cursor()

    # Old/simple predictions table used early in development
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            age INTEGER,
            sex TEXT,
            cp TEXT,
            risk_percent REAL NOT NULL,
            risk_band TEXT NOT NULL
        );
        """
    )

    # Users table
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'employee', 'it_technician', 'clinician'))
        );
        """
    )

    # Safe column migrations
    for col_sql in [
        "ALTER TABLE users ADD COLUMN first_name TEXT",
        "ALTER TABLE users ADD COLUMN last_name TEXT",
        "ALTER TABLE users ADD COLUMN clinician_uid TEXT",
        "ALTER TABLE users ADD COLUMN email TEXT",
        "ALTER TABLE users ADD COLUMN department TEXT",
        "ALTER TABLE users ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved'",
        "ALTER TABLE users ADD COLUMN denial_reason TEXT",
    ]:
        try:
            cur.execute(col_sql)
        except sqlite3.OperationalError:
            # Column already exists
            pass

    # Unique indexes
    cur.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clinician_uid
        ON users (clinician_uid)
        """
    )

    cur.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
        ON users (email)
        """
    )

    # Patients table
    cur.execute(
        """
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
        """
    )

    # Assessments table
    cur.execute(
        """
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
        """
    )

    cur.execute(
    """
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        actor_user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        target_user_id INTEGER,
        target_username TEXT,
        details TEXT,
        FOREIGN KEY(actor_user_id) REFERENCES users(id)
    );
    """
)

    conn.commit()
    conn.close()


# --------------------------------------------------
# General User Access
# --------------------------------------------------

def get_user_by_username(username: str) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE username = ?", (username,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_email(email: str) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE email = ?", (email,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_id(user_id: int) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, username, role, first_name, last_name, clinician_uid,
               email, department, approval_status, denial_reason
        FROM users
        WHERE id = ?
        """,
        (user_id,),
    )
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def create_user(username: str, password_hash: str, role: str) -> int:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO users (created_at, username, password_hash, role, approval_status)
        VALUES (?, ?, ?, ?, ?)
        """,
        (datetime.utcnow().isoformat(), username, password_hash, role, "approved"),
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return new_id


# --------------------------------------------------
# Role / Signup Helpers
# --------------------------------------------------

def generate_clinician_uid() -> str:
    date_part = datetime.utcnow().strftime("%Y%m%d")
    rand_part = secrets.token_hex(2).upper()
    return f"CLN-{date_part}-{rand_part}"


def create_clinician_user(username: str, password_hash: str, first_name: str, last_name: str) -> dict:
    """
    Admin-created clinician user. Approved immediately.
    """
    conn = get_conn()
    cur = conn.cursor()

    clinician_uid = generate_clinician_uid()
    while True:
        try:
            cur.execute(
                """
                INSERT INTO users (
                    created_at, username, password_hash, role,
                    clinician_uid, first_name, last_name, approval_status
                )
                VALUES (?, ?, ?, 'clinician', ?, ?, ?, ?)
                """,
                (
                    datetime.utcnow().isoformat(),
                    username,
                    password_hash,
                    clinician_uid,
                    first_name,
                    last_name,
                    "approved",
                ),
            )
            conn.commit()
            new_id = cur.lastrowid
            conn.close()
            return {"id": new_id, "clinician_uid": clinician_uid}
        except sqlite3.IntegrityError:
            clinician_uid = generate_clinician_uid()


def create_pending_clinician_user(
    username: str,
    password_hash: str,
    first_name: str,
    last_name: str,
    email: str,
    department: str
) -> dict:
    """
    Public signup request. Stored as pending until admin approval.
    """
    conn = get_conn()
    cur = conn.cursor()

    clinician_uid = generate_clinician_uid()
    while True:
        try:
            cur.execute(
                """
                INSERT INTO users (
                    created_at, username, password_hash, role,
                    clinician_uid, first_name, last_name,
                    email, department, approval_status
                )
                VALUES (?, ?, ?, 'clinician', ?, ?, ?, ?, ?, ?)
                """,
                (
                    datetime.utcnow().isoformat(),
                    username,
                    password_hash,
                    clinician_uid,
                    first_name,
                    last_name,
                    email,
                    department,
                    "pending",
                ),
            )
            conn.commit()
            new_id = cur.lastrowid
            conn.close()
            return {
                "id": new_id,
                "clinician_uid": clinician_uid,
                "approval_status": "pending",
            }
        except sqlite3.IntegrityError:
            clinician_uid = generate_clinician_uid()


# --------------------------------------------------
# Admin - Full User Management
# --------------------------------------------------

def count_admin_users() -> int:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'")
    row = cur.fetchone()
    conn.close()
    return int(row["total"]) if row else 0


def create_full_user(
    username: str,
    password_hash: str,
    role: str,
    first_name: str,
    last_name: str,
    email: str,
    department: str
) -> dict:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO users (
            created_at, username, password_hash, role,
            first_name, last_name, email, department, approval_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            datetime.utcnow().isoformat(),
            username,
            password_hash,
            role,
            first_name,
            last_name,
            email,
            department,
            "approved",
        ),
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return get_user_by_id(new_id)


def list_all_users() -> list[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, created_at, username, role, first_name, last_name,
               clinician_uid, email, department, approval_status, denial_reason
        FROM users
        ORDER BY id DESC
        """
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def list_pending_users() -> list[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, created_at, username, role, first_name, last_name,
               clinician_uid, email, department, approval_status
        FROM users
        WHERE approval_status = 'pending'
        ORDER BY id DESC
        """
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def list_clinicians() -> list[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, created_at, username, clinician_uid, first_name, last_name,
               role, email, department, approval_status
        FROM users
        WHERE role = 'clinician'
        ORDER BY id DESC
        """
    )
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
        WHERE id = ? AND role = 'clinician'
        """,
        (first_name, last_name, clinician_id),
    )
    ok = cur.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def delete_clinician(clinician_id: int) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM users WHERE id = ? AND role = 'clinician'", (clinician_id,))
    ok = cur.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def update_user_admin(user_id: int, first_name: str, last_name: str, role: str, department: str) -> bool:
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT role FROM users WHERE id = ?", (user_id,))
    existing = cur.fetchone()
    if not existing:
        conn.close()
        return False

    current_role = existing["role"]

    if current_role == "admin" and role != "admin":
        cur.execute("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'")
        admin_count = cur.fetchone()["total"]
        if admin_count <= 1:
            conn.close()
            raise ValueError("Cannot remove admin role from the last remaining admin.")

    cur.execute(
        """
        UPDATE users
        SET first_name = ?, last_name = ?, role = ?, department = ?
        WHERE id = ?
        """,
        (first_name, last_name, role, department, user_id),
    )
    ok = cur.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def delete_user_admin(user_id: int) -> bool:
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT role FROM users WHERE id = ?", (user_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return False

    if row["role"] == "admin":
        cur.execute("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'")
        admin_count = cur.fetchone()["total"]
        if admin_count <= 1:
            conn.close()
            raise ValueError("Cannot delete the last remaining admin.")

    cur.execute("DELETE FROM users WHERE id = ?", (user_id,))
    ok = cur.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def approve_user_request(user_id: int, approved_role: str) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE users
        SET approval_status = 'approved',
            role = ?,
            denial_reason = NULL
        WHERE id = ? AND approval_status = 'pending'
        """,
        (approved_role, user_id),
    )
    ok = cur.rowcount > 0
    conn.commit()
    conn.close()
    return ok


def deny_user_request(user_id: int, denial_reason: str) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE users
        SET approval_status = 'rejected',
            denial_reason = ?
        WHERE id = ? AND approval_status = 'pending'
        """,
        (denial_reason, user_id),
    )
    ok = cur.rowcount > 0
    conn.commit()
    conn.close()
    return ok

def create_audit_log(actor_user_id: int, action: str, target_user_id: int | None = None, target_username: str | None = None, details: str | None = None) -> int:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO audit_logs (created_at, actor_user_id, action, target_user_id, target_username, details)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            datetime.utcnow().isoformat(),
            actor_user_id,
            action,
            target_user_id,
            target_username,
            details,
        ),
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return new_id


def list_audit_logs(limit: int = 100) -> list[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT a.id, a.created_at, a.actor_user_id, a.action, a.target_user_id,
               a.target_username, a.details,
               u.username AS actor_username
        FROM audit_logs a
        LEFT JOIN users u ON a.actor_user_id = u.id
        ORDER BY a.id DESC
        LIMIT ?
        """,
        (limit,),
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


# --------------------------------------------------
# Clinician - Patient CRUD
# --------------------------------------------------

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
                (datetime.utcnow().isoformat(), patient_uid, first_name, last_name, dob, sex, created_by_user_id),
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
                "sex": sex,
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


def get_patient_by_uid_for_clinician(patient_uid: str, clinician_id: int) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT *
        FROM patients
        WHERE patient_uid = ?
          AND created_by_user_id = ?
        """,
        (patient_uid, clinician_id),
    )
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def search_patients(patient_uid: str = "", name: str = "", limit: int = 25) -> list[dict]:
    conn = get_conn()
    cur = conn.cursor()

    patient_uid = (patient_uid or "").strip()
    name = (name or "").strip()

    if patient_uid:
        cur.execute(
            "SELECT * FROM patients WHERE patient_uid = ? ORDER BY id DESC LIMIT ?",
            (patient_uid, limit)
        )

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
        cur.execute(
            """
            SELECT * FROM patients
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,)
        )

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
        (first_name, last_name, dob, sex, patient_uid),
    )
    if cur.rowcount == 0:
        conn.close()
        return None
    conn.commit()
    conn.close()
    return get_patient_by_uid(patient_uid)


# --------------------------------------------------
# Clinician - Assessment CRUD
# --------------------------------------------------

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
            created_at,
            clinician_id,
            patient_uid,
            inputs.get("age"),
            inputs.get("sex"),
            inputs.get("cp"),
            inputs.get("trestbps"),
            inputs.get("chol"),
            inputs.get("fbs"),
            inputs.get("restecg"),
            inputs.get("thalch"),
            inputs.get("exang"),
            inputs.get("oldpeak"),
            inputs.get("slope"),
            inputs.get("ca"),
            inputs.get("thal"),
            risk_percent,
            risk_band,
        ),
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()

    return {
        "id": new_id,
        "created_at": created_at,
        "patient_uid": patient_uid,
        "risk_percent": risk_percent,
        "risk_band": risk_band,
    }


def get_assessment_by_id(assessment_id: int, clinician_id: int) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM assessments WHERE id = ? AND clinician_id = ?",
        (assessment_id, clinician_id),
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
        (patient_uid, clinician_id, limit),
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


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
            inputs.get("age"),
            inputs.get("sex"),
            inputs.get("cp"),
            inputs.get("trestbps"),
            inputs.get("chol"),
            inputs.get("fbs"),
            inputs.get("restecg"),
            inputs.get("thalch"),
            inputs.get("exang"),
            inputs.get("oldpeak"),
            inputs.get("slope"),
            inputs.get("ca"),
            inputs.get("thal"),
            risk_percent,
            risk_band,
            assessment_id,
            clinician_id,
        ),
    )
    ok = cur.rowcount > 0
    conn.commit()
    conn.close()
    return ok

def delete_patient_by_uid(patient_uid: str, clinician_id: int) -> bool:
    """
    Delete a patient owned by the given clinician.
    Also deletes all linked assessments for that patient.
    """
    conn = get_conn()
    cur = conn.cursor()

    try:
        # First delete all assessments linked to this patient
        cur.execute(
            """
            DELETE FROM assessments
            WHERE patient_uid = ? AND clinician_id = ?
            """,
            (patient_uid, clinician_id),
        )

        # Then delete the patient only if it belongs to this clinician
        cur.execute(
            """
            DELETE FROM patients
            WHERE patient_uid = ? AND created_by_user_id = ?
            """,
            (patient_uid, clinician_id),
        )

        deleted = cur.rowcount > 0
        conn.commit()
        conn.close()
        return deleted

    except Exception:
        conn.rollback()
        conn.close()
        raise


def count_assessments_for_patient(patient_uid: str, clinician_id: int) -> int:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT COUNT(*) AS total
        FROM assessments
        WHERE patient_uid = ? AND clinician_id = ?
        """,
        (patient_uid, clinician_id),
    )
    row = cur.fetchone()
    conn.close()
    return int(row["total"]) if row else 0

def delete_assessment(assessment_id: int, clinician_id: int) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM assessments WHERE id = ? AND clinician_id = ?",
        (assessment_id, clinician_id)
    )
    ok = cur.rowcount > 0
    conn.commit()
    conn.close()
    return ok