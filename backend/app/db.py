import sqlite3
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).resolve().parent / "cardiox.db"

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    cur = conn.cursor()
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
    conn.commit()
    conn.close()

def save_prediction(age, sex, cp, risk_percent, risk_band):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO predictions (created_at, age, sex, cp, risk_percent, risk_band)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (datetime.utcnow().isoformat(), age, sex, cp, risk_percent, risk_band)
    )
    conn.commit()
    conn.close()

def list_predictions(limit: int = 50):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM predictions ORDER BY id DESC LIMIT ?",
        (limit,)
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]
