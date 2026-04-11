# CardioX — AI-Powered Cardiovascular Decision Support System

## Overview
CardioX is a full-stack, AI-powered clinical decision support system designed to assist healthcare professionals in assessing the risk of cardiovascular disease (CVD). The platform integrates machine learning, explainable AI (XAI), and secure role-based access control to provide interpretable and actionable insights.

The system is designed to reflect real-world clinical workflows and supports clinicians in managing patient records, conducting structured assessments, and reviewing historical predictions in a secure and auditable environment.

---

## Key Features

### Clinician Functionality
- Create, view, update, and delete patient records
- Perform cardiovascular risk assessments using a machine learning model
- View and manage assessment history
- Edit and delete assessment records
- Export assessment reports in PDF format (clinician and patient versions)

### AI and Explainability
- Machine learning-based heart attack risk prediction
- Risk output provided as:
  - Percentage probability
  - Risk category (Low, Moderate, High)
- Explainable AI using SHAP to highlight key contributing features
- AI-generated clinical recommendations based on prediction outputs

### Authentication and Security
- Secure login and signup system with approval workflow
- Password hashing using bcrypt
- JWT-based authentication
- Role-based access control (Admin, Clinician, and other roles)

### Admin Functionality
- View and manage all system users
- Edit user roles, names, and departments
- Approve or deny clinician registration requests
- Delete users from the system
- Full audit logging of administrative actions

### Audit and Traceability
- Centralised audit logging system
- Tracks critical actions such as:
  - User updates
  - Account approvals and denials
  - User deletions

---

## Technology Stack

### Frontend
- HTML5
- CSS3 (custom responsive UI)
- JavaScript (Vanilla JS)

### Backend
- FastAPI (Python)
- SQLite database
- RESTful API architecture

### Machine Learning
- Scikit-learn model
- SHAP (SHapley Additive exPlanations) for interpretability

### Security
- Passlib (bcrypt password hashing)
- JSON Web Tokens (JWT)

---

## Project Structure

cardiox/
│
├── app/
│ ├── auth/ # Authentication (JWT, password hashing)
│ ├── db.py # Database logic (SQLite)
│ ├── ml/ # Machine learning model and inference
│ ├── reporting/ # PDF report generation
│
├── assets/
│ ├── styles.css
│ ├── clinician.js
│ ├── admin.js
│ ├── navbar.js
│
├── main.py # FastAPI application entry point
├── cardiox.db # Local SQLite database
├── README.md


## How to Run the Project Locally

### 1. Clone the Repository
git clone https://github.com/VanshikaBhar04/cardiox.git

cd cardiox

### 2. Create a Virtual Environment
python -m venv venv

Activate the environment:

- macOS/Linux:

source venv/bin/activate


- Windows:

venv\Scripts\activate


### 3. Install Dependencies

pip install -r requirements.txt


If a requirements file is not available, install manually:

pip install fastapi uvicorn passlib[bcrypt] python-jose shap scikit-learn


### 4. Run the Backend Server

uvicorn main:app --reload


The API will be available at:

http://127.0.0.1:8000


### 5. Open the Frontend
Open the `login.html` file in a browser, or use a local development server such as Live Server.

---

## Default Login Credentials

Admin account: 
Username: admin
Password: admin123


---

## System Workflow

1. Admin logs into the system
2. Admin approves clinician registration requests or creates users directly
3. Clinician logs in after approval
4. Clinician creates and manages patient records
5. Clinician performs cardiovascular risk assessments
6. The system returns:
   - Risk prediction
   - Explainability insights (SHAP)
   - Clinical advice
7. Clinician reviews or exports assessment reports

---

## Explainable AI (XAI)

CardioX incorporates SHAP (SHapley Additive exPlanations) to enhance transparency in machine learning predictions.

This enables:
- Identification of key contributing risk factors
- Improved interpretability of model outputs
- Increased trust in AI-assisted clinical decision-making

---

## Security Considerations

- All passwords are securely hashed using bcrypt
- JWT tokens are used for secure authentication and session management
- Role-based access control is enforced on all protected endpoints
- Administrative actions are logged for audit and traceability

---

## Future Improvements

- Deployment to cloud platforms (e.g. AWS or Azure)
- Integration with real-world healthcare datasets
- Enhanced user interface using modern frameworks such as React
- Implementation of multi-factor authentication (MFA)
- Advanced analytics dashboards for clinical insights

---

## Author

Vanshika Bharadwaj  
BSc Computer Science — Final Year Project  
CardioX: AI-Based Heart Attack Prediction System

---

## License

This project is intended for academic purposes only.


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

---
## Run the Backend (FastAPI)
Open a terminal:

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

