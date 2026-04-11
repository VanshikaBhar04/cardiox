# --------------------------------------------------
# CardioX Inference, Explainability, and Advice Engine
# --------------------------------------------------

# This module loads the trained machine learning model and provides:
# - cardiovascular risk prediction
# - SHAP-based local explainability
# - source-backed personalised advice generation

from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np
import pandas as pd
import shap


# --------------------------------------------------
# Model Loading
# --------------------------------------------------

# Path to the trained machine learning model artifact
MODEL_PATH = Path(__file__).resolve().parents[3] / "ml" / "artifacts" / "final_model.joblib"

# Load the model once at startup to avoid repeated disk reads during inference
_model = joblib.load(MODEL_PATH)


# --------------------------------------------------
# Risk Helpers
# --------------------------------------------------

def risk_band(risk_percent: float) -> str:
    """
    Maps a predicted risk percentage into a UI-friendly band.
    These are prototype thresholds and not clinical standards.
    """
    if risk_percent < 40:
        return "Low"
    if risk_percent < 60:
        return "Moderate"
    return "High"


def predict_risk(patient: dict) -> dict:
    """
    Accepts raw patient feature values using the same names as the dataset
    and returns a risk percentage with a corresponding display band.
    """
    X = pd.DataFrame([patient])

    # Predict probability for the positive class
    prob = float(_model.predict_proba(X)[:, 1][0])

    # Convert probability to a percentage for UI display
    risk_percent = prob * 100

    return {
        "risk_percent": round(risk_percent, 2),
        "risk_band": risk_band(risk_percent),
    }


# --------------------------------------------------
# SHAP Normalisation Helpers
# --------------------------------------------------

def _extract_positive_class_shap(shap_values: Any) -> np.ndarray:
    """
    Normalises SHAP outputs across library versions and model types
    into a 1D array of feature contributions for the positive class.
    """
    if isinstance(shap_values, list):
        mat = shap_values[1] if len(shap_values) > 1 else shap_values[0]
        return np.asarray(mat)[0]

    arr = np.asarray(shap_values)

    if arr.ndim == 2:
        return arr[0]

    if arr.ndim == 3 and arr.shape[0] <= 10:
        class_idx = 1 if arr.shape[0] > 1 else 0
        return arr[class_idx, 0, :]

    if arr.ndim == 3:
        class_idx = 1 if arr.shape[-1] > 1 else 0
        return arr[0, :, class_idx]

    raise ValueError(f"Unexpected SHAP values shape: {arr.shape}")


def _extract_expected_value(expected_value: Any) -> float:
    """
    Normalises SHAP expected values across versions and model types
    into a single float for the positive class where available.
    """
    ev = expected_value

    if isinstance(ev, (list, np.ndarray)):
        ev = np.asarray(ev).flatten()
        return float(ev[1]) if ev.size > 1 else float(ev[0])

    return float(ev)


# --------------------------------------------------
# Feature Name Formatting Helpers
# --------------------------------------------------

def _prettify_feature_name(name: str) -> str:
    """
    Converts raw or transformed feature names into more readable labels
    for the clinician-facing explainability UI.
    """
    if not name:
        return "Unknown Feature"

    pretty_map = {
        "age": "Age",
        "sex": "Sex",
        "cp": "Chest Pain Type",
        "trestbps": "Resting Blood Pressure",
        "chol": "Cholesterol",
        "fbs": "Fasting Blood Sugar",
        "restecg": "Rest ECG",
        "thalch": "Max Heart Rate",
        "exang": "Exercise-Induced Angina",
        "oldpeak": "Oldpeak",
        "slope": "ST Segment Slope",
        "ca": "Major Vessels (CA)",
        "thal": "Thal",
    }

    raw = name

    if "__" in raw:
        raw = raw.split("__", 1)[1]

    for key in pretty_map:
        if raw == key:
            return pretty_map[key]
        if raw.startswith(f"{key}_"):
            suffix = raw[len(key) + 1:]
            if suffix:
                return f"{pretty_map[key]}: {suffix}"
            return pretty_map[key]

    return raw.replace("_", " ").title()


def _raw_feature_key_from_transformed(name: str) -> Optional[str]:
    """
    Attempts to map transformed feature names back to the original
    raw patient field name used in the input payload.
    """
    if not name:
        return None

    raw = name

    if "__" in raw:
        raw = raw.split("__", 1)[1]

    known_keys = [
        "age",
        "sex",
        "cp",
        "trestbps",
        "chol",
        "fbs",
        "restecg",
        "thalch",
        "exang",
        "oldpeak",
        "slope",
        "ca",
        "thal",
    ]

    for key in known_keys:
        if raw == key or raw.startswith(f"{key}_"):
            return key

    return None


# --------------------------------------------------
# SHAP Feature Selection Helpers
# --------------------------------------------------

def _select_top_unique_features(
    feature_names: list[str],
    shap_values: np.ndarray,
    patient: dict,
    top_k: int,
) -> list[dict]:
    """
    Selects the most important SHAP features while avoiding multiple
    transformed columns from the same raw feature dominating the output.
    """
    idx_sorted = np.argsort(np.abs(shap_values))[::-1]

    top_factors = []
    seen_raw_keys = set()

    for i in idx_sorted:
        i = int(i)
        raw_name = feature_names[i]
        base_key = _raw_feature_key_from_transformed(raw_name) or raw_name

        if base_key in seen_raw_keys:
            continue

        seen_raw_keys.add(base_key)

        s = float(shap_values[i])
        top_factors.append({
            "feature": base_key,
            "display_feature": _prettify_feature_name(raw_name),
            "value": patient.get(base_key),
            "shap": round(s, 4),
            "direction": "increases" if s > 0 else "decreases",
        })

        if len(top_factors) >= top_k:
            break

    return top_factors


# --------------------------------------------------
# Explainability Logic
# --------------------------------------------------

def explain_risk(patient: dict, top_k: int = 6) -> dict:
    """
    Generates a SHAP local explanation for a single patient.

    Supported model forms:
    - plain RandomForestClassifier
    - sklearn Pipeline with preprocessing + classifier

    Returns:
      {
        "base_value": float,
        "top_factors": [
            {
                "feature": str,
                "display_feature": str,
                "value": Any | None,
                "shap": float,
                "direction": "increases" | "decreases"
            }
        ]
      }
    """
    X_raw = pd.DataFrame([patient])

    if hasattr(_model, "named_steps"):
        preprocess = None

        for k in ["preprocess", "preprocessor", "columntransformer"]:
            if k in _model.named_steps:
                preprocess = _model.named_steps[k]
                break

        clf = list(_model.named_steps.values())[-1]

        if preprocess is not None:
            X_trans = preprocess.transform(X_raw)

            try:
                feature_names = preprocess.get_feature_names_out().tolist()
            except Exception:
                feature_names = [f"f{i}" for i in range(X_trans.shape[1])]

            explainer = shap.TreeExplainer(clf)
            shap_values = explainer.shap_values(X_trans)

            shap_pos = _extract_positive_class_shap(shap_values)
            base_val = _extract_expected_value(explainer.expected_value)

            top_factors = _select_top_unique_features(
                feature_names=feature_names,
                shap_values=shap_pos,
                patient=patient,
                top_k=top_k,
            )

            return {
                "base_value": round(base_val, 4),
                "top_factors": top_factors,
            }

        explainer = shap.Explainer(_model)
        sv = explainer(X_raw)
        return _format_shap_explainer_output(sv, X_raw, patient, top_k)

    explainer = shap.TreeExplainer(_model)
    shap_values = explainer.shap_values(X_raw)

    shap_pos = _extract_positive_class_shap(shap_values)
    feature_names = list(X_raw.columns)
    base_val = _extract_expected_value(explainer.expected_value)

    top_factors = _select_top_unique_features(
        feature_names=feature_names,
        shap_values=shap_pos,
        patient=patient,
        top_k=top_k,
    )

    return {
        "base_value": round(base_val, 4),
        "top_factors": top_factors,
    }


def _format_shap_explainer_output(
    sv,
    X_raw: pd.DataFrame,
    patient: dict,
    top_k: int,
) -> dict:
    """
    Formats outputs from shap.Explainer into the same structure
    used by the main explainability response.
    """
    values = np.asarray(sv.values)

    if values.ndim == 3:
        class_idx = 1 if values.shape[-1] > 1 else 0
        shap_vals = values[0, :, class_idx]
    else:
        shap_vals = values[0, :]

    feature_names = list(X_raw.columns)

    base_val = sv.base_values
    base_val = float(np.asarray(base_val).flatten()[0])

    top_factors = _select_top_unique_features(
        feature_names=feature_names,
        shap_values=shap_vals,
        patient=patient,
        top_k=top_k,
    )

    return {
        "base_value": round(base_val, 4),
        "top_factors": top_factors,
    }


# --------------------------------------------------
# Source-Backed Advice Generation
# --------------------------------------------------

def generate_advice(patient: dict, top_factors: list[dict]) -> list[dict]:
    """
    Generates model-informed but source-backed advice.
    Advice is prioritised using SHAP features that increased risk.

    Each item is formatted for the UI and includes source metadata.
    """
    increasing = {
        f.get("feature")
        for f in top_factors
        if f.get("direction") == "increases"
    }

    advice: list[dict] = []

    def add(
        key: str,
        title: str,
        reason: str,
        action: str,
        source_name: str,
        source_label: str,
        source_url: str,
    ):
        advice.append({
            "key": key,
            "title": title,
            "reason": reason,
            "action": action,
            "source_name": source_name,
            "source_label": source_label,
            "source_url": source_url,
        })

    trestbps = patient.get("trestbps")
    chol = patient.get("chol")
    fbs = str(patient.get("fbs", "")).strip().lower()
    exang = str(patient.get("exang", "")).strip().lower()
    thalch = patient.get("thalch")
    oldpeak = patient.get("oldpeak")

    if trestbps is not None and float(trestbps) >= 140:
        add(
            key="trestbps",
            title="Review blood pressure control",
            reason=f"Resting blood pressure is {trestbps}, which may contribute to a higher cardiovascular risk profile.",
            action="Encourage blood pressure review, lifestyle optimisation, regular monitoring, and clinical follow-up in line with local care pathways.",
            source_name="NICE",
            source_label="NICE NG238 cardiovascular prevention guidance",
            source_url="https://www.nice.org.uk/guidance/ng238",
        )

    if chol is not None and float(chol) >= 240:
        add(
            key="chol",
            title="Improve cholesterol management",
            reason=f"Cholesterol is {chol}, which may increase the patient’s cardiovascular risk estimate.",
            action="Encourage reduction of saturated fat intake, improvement of diet quality, and regular physical activity. Consider whether lipid management review is clinically appropriate.",
            source_name="NHS",
            source_label="NHS guidance on lowering cholesterol",
            source_url="https://www.nhs.uk/conditions/high-cholesterol/how-to-lower-your-cholesterol/",
        )

    if fbs == "true":
        add(
            key="fbs",
            title="Review glucose-related risk",
            reason="Fasting blood sugar is marked as raised, which may indicate broader cardiometabolic risk.",
            action="Consider appropriate follow-up of glycaemic status and reinforce dietary, activity, and weight-management advice where clinically relevant.",
            source_name="NHS",
            source_label="NHS cardiovascular prevention guidance",
            source_url="https://www.nhs.uk/conditions/coronary-heart-disease/prevention/",
        )

    if exang == "true":
        add(
            key="exang",
            title="Assess exertional symptoms carefully",
            reason="Exercise-induced angina is present and may indicate clinically relevant cardiovascular strain.",
            action="Review symptom history carefully and consider whether further cardiovascular evaluation is appropriate within the patient’s wider clinical context.",
            source_name="NICE",
            source_label="NICE cardiovascular risk and prevention guidance",
            source_url="https://www.nice.org.uk/guidance/ng238",
        )

    if thalch is not None and float(thalch) < 120:
        add(
            key="thalch",
            title="Review exercise tolerance and fitness profile",
            reason=f"Maximum heart rate is {thalch}, which may be relevant when interpreted alongside other cardiovascular indicators.",
            action="Encourage clinician-led review of exercise tolerance and consider graded lifestyle activity advice where appropriate.",
            source_name="American Heart Association",
            source_label="AHA physical activity and heart-health guidance",
            source_url="https://www.heart.org/en/healthy-living/fitness/fitness-basics/aha-recs-for-physical-activity-in-adults",
        )

    if oldpeak is not None and float(oldpeak) >= 2:
        add(
            key="oldpeak",
            title="Review ST-depression related risk indicators",
            reason=f"Oldpeak is {oldpeak}, which may indicate a more concerning exercise-related cardiac pattern.",
            action="Correlate this value with symptoms, ECG findings, and wider assessment results when determining the next clinical step.",
            source_name="NICE",
            source_label="NICE cardiovascular prevention and review guidance",
            source_url="https://www.nice.org.uk/guidance/ng238",
        )

    # Prioritise advice linked to features that increased model risk
    advice.sort(key=lambda a: (0 if a["key"] in increasing else 1, a["title"]))

    # Always include a general prevention item
    advice.append({
        "key": "general_prevention",
        "title": "Maintain heart-healthy lifestyle measures",
        "reason": "General prevention remains important even when one single dominant modifiable factor is not clearly identified.",
        "action": "Encourage regular physical activity, a balanced heart-healthy diet, healthy weight, smoking avoidance, and appropriate routine follow-up.",
        "source_name": "American Heart Association",
        "source_label": "AHA adult physical activity and heart-health guidance",
        "source_url": "https://www.heart.org/en/healthy-living/fitness/fitness-basics/aha-recs-for-physical-activity-in-adults",
    })

    # Remove internal sorting key before returning UI-ready data
    for item in advice:
        item.pop("key", None)

    return advice[:4]


# --------------------------------------------------
# Combined Prediction + Explainability Helper
# --------------------------------------------------

def predict_with_explainability(patient: dict, top_k: int = 6) -> dict:
    """
    Convenience helper that returns both prediction output
    and local explainability in a single response structure.
    """
    pred = predict_risk(patient)
    xai = explain_risk(patient, top_k=top_k)

    return {
        "prediction": pred,
        "explainability": xai,
    }


# --------------------------------------------------
# Local Test Example
# --------------------------------------------------

if __name__ == "__main__":
    example_patient = {
        "age": 63,
        "sex": "Male",
        "cp": "typical angina",
        "trestbps": 145,
        "chol": 233,
        "fbs": "False",
        "restecg": "lv hypertrophy",
        "thalch": 150,
        "exang": "False",
        "oldpeak": 2.3,
        "slope": "downsloping",
        "ca": 0.0,
        "thal": "fixed defect",
    }

    prediction = predict_risk(example_patient)
    explanation = explain_risk(example_patient, top_k=6)
    advice = generate_advice(example_patient, explanation["top_factors"])

    print({
        "prediction": prediction,
        "explainability": explanation,
        "advice": advice,
    })