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


## CardioX – AI Heart Attack Risk Assessment System

CardioX is an AI-powered cardiovascular risk prediction platform designed to support clinicians and NHS healthcare professionals with interpretable heart attack risk assessment.

The system generates probability-based cardiovascular risk scores based on structured clinical data.

## CardioX Microsite

Learn more about the CardioX platform here:

👉 **[Visit the CardioX Microsite](https://sites.google.com/view/cardioxpredictor/home)**

Direct URL:  
https://sites.google.com/view/cardioxpredictor/home

## Key Features
- AI-powered cardiovascular risk prediction
- Probability-based risk scoring
- Clear risk band classification
- GDPR-compliant data handling
- Designed for NHS clinical decision support

## Purpose
This repository demonstrates the digital marketing and SEO strategy for the CardioX microsite, including search optimisation and healthcare-focused keyword strategy.

https://sites.google.com/view/cardioxpredictor/home
