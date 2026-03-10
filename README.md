# CardioX

# CardioX – Heart Attack Risk Prediction (Prototype)

CardioX is a clinician-facing prototype that predicts a probability-based heart attack risk score using a trained machine learning model and provides results through a FastAPI backend + simple web frontend.

## Project Structure
- `ml/` – model training + inference logic (Random Forest selected by ROC-AUC)
- `backend/` – FastAPI API (`/predict`, `/predictions`)
- `frontend/` – HTML/CSS/JS UI calling the API

---

## Requirements
- macOS
- Python 3.11+
- Homebrew (recommended)
- Backend runs on: `http://127.0.0.1:8000`
- Frontend runs on: `http://127.0.0.1:5500`

---

## Run the Backend (FastAPI)
Open a terminal:

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

