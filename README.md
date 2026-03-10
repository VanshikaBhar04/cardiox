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

---

# CardioX – AI Heart Attack Risk Assessment System

CardioX is an AI-powered cardiovascular risk prediction platform designed to support clinicians and NHS healthcare professionals in assessing a patient’s probability of experiencing a heart attack. The system analyses structured clinical data using machine learning and generates interpretable, probability-based risk scores to assist clinical decision-making.

## CardioX Microsite

The CardioX microsite presents the platform’s functionality, clinical value, and governance considerations for healthcare organisations exploring AI-driven cardiovascular risk assessment tools.

👉 **[Visit the CardioX Microsite](https://sites.google.com/view/cardioxpredictor/home)**

Direct link:  
https://sites.google.com/view/cardioxpredictor/home

## Key Features

- AI-powered cardiovascular risk prediction  
- Probability-based heart attack risk scoring  
- Clear and interpretable risk band classification  
- GDPR-compliant data governance considerations  
- Designed for NHS clinical decision-support environments  

## Project Purpose

This repository demonstrates the technical concept behind CardioX alongside the digital marketing and search engine optimisation (SEO) strategy used to promote the CardioX microsite. The project illustrates how healthcare AI solutions can be communicated through structured digital marketing, keyword optimisation, and targeted B2B outreach to NHS organisations.
