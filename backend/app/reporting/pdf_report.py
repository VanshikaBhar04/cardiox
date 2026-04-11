# --------------------------------------------------
# CardioX PDF Report Builder
# --------------------------------------------------

# Generates clinician-facing and patient-facing PDF reports
# for cardiovascular assessment results using ReportLab.

from datetime import datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


# --------------------------------------------------
# Formatting Helpers
# --------------------------------------------------

def safe(value, fallback="—"):
    """
    Returns a printable fallback for empty or missing values
    so reports remain clean and readable.
    """
    if value is None or value == "":
        return fallback
    return str(value)


def format_dt(value: str) -> str:
    """
    Formats ISO datetime strings into a clinician-friendly
    day/month/year and time format for reports.
    """
    if not value:
        return "—"

    try:
        dt = datetime.fromisoformat(value)
        return dt.strftime("%d/%m/%Y %H:%M:%S")
    except Exception:
        return value


def nice_feature_name(name: str) -> str:
    """
    Converts raw model feature names into clearer report labels
    for clinical readability.
    """
    mapping = {
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
    return mapping.get(name, name.replace("_", " ").title())


def risk_band_color(risk_band: str):
    """
    Maps risk band labels to consistent colours for visual emphasis
    in the exported PDF summary tables.
    """
    risk_band = (risk_band or "").lower()

    if risk_band == "high":
        return colors.HexColor("#dc2626")
    if risk_band == "moderate":
        return colors.HexColor("#f59e0b")
    return colors.HexColor("#16a34a")


# --------------------------------------------------
# Style Definitions
# --------------------------------------------------

def build_styles():
    """
    Defines the shared CardioX PDF text styles used across
    both patient and clinician reports.
    """
    styles = getSampleStyleSheet()

    styles.add(
        ParagraphStyle(
            name="CardioXTitle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=12,
        )
    )

    styles.add(
        ParagraphStyle(
            name="CardioXSection",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=15,
            textColor=colors.HexColor("#2563eb"),
            spaceBefore=8,
            spaceAfter=8,
        )
    )

    styles.add(
        ParagraphStyle(
            name="CardioXBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#334155"),
            alignment=TA_LEFT,
            spaceAfter=6,
        )
    )

    styles.add(
        ParagraphStyle(
            name="CardioXSmall",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#475569"),
            alignment=TA_LEFT,
            spaceAfter=5,
        )
    )

    styles.add(
        ParagraphStyle(
            name="CardioXHighlight",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=6,
        )
    )

    return styles


# --------------------------------------------------
# Table Builders
# --------------------------------------------------

def build_info_table(rows):
    """
    Creates a shared two-column information table used for
    patient details, structured inputs, and report summaries.
    """
    table = Table(rows, colWidths=[55 * mm, 115 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#dbe2ef")),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#dbe2ef")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("LEADING", (0, 0), (-1, -1), 12),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return table


# --------------------------------------------------
# Patient Report Builder
# --------------------------------------------------

def build_patient_report(story, styles, clinician_name, patient, assessment, advice):
    """
    Builds a simplified patient-facing report with a clear summary,
    practical explanation, and supportive next-step guidance.
    """
    story.append(Paragraph("CardioX Patient Report", styles["CardioXTitle"]))
    story.append(
        Paragraph(
            "This report provides a simple summary of your cardiovascular risk assessment in clear language.",
            styles["CardioXBody"],
        )
    )

    story.append(Spacer(1, 6))

    summary_color = risk_band_color(assessment.get("risk_band"))
    summary_table = Table(
        [
            ["Estimated Risk", f"{safe(assessment.get('risk_percent'))}%"],
            ["Risk Band", safe(assessment.get("risk_band"))],
            ["Assessment Date", format_dt(assessment.get("created_at"))],
        ],
        colWidths=[60 * mm, 70 * mm],
    )
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#dbe2ef")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dbe2ef")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
                ("TEXTCOLOR", (1, 1), (1, 1), summary_color),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )
    story.append(summary_table)

    story.append(Spacer(1, 12))
    story.append(Paragraph("Patient Summary", styles["CardioXSection"]))
    story.append(
        build_info_table(
            [
                ["Patient ID", safe(patient.get("patient_uid"))],
                ["Name", f"{safe(patient.get('first_name'))} {safe(patient.get('last_name'))}"],
                ["Date of Birth", safe(patient.get("dob"))],
                ["Sex", safe(patient.get("sex"))],
                ["Clinician", safe(clinician_name)],
            ]
        )
    )

    story.append(Spacer(1, 12))
    story.append(Paragraph("What this means", styles["CardioXSection"]))
    story.append(
        Paragraph(
            "This result is designed to support clinical review. It should be discussed with a healthcare professional and interpreted alongside your wider medical history, symptoms, and other tests.",
            styles["CardioXBody"],
        )
    )

    story.append(Spacer(1, 8))
    story.append(Paragraph("Helpful next steps", styles["CardioXSection"]))

    for item in advice[:4]:
        story.append(
            Paragraph(
                f"<b>{safe(item.get('title'))}</b><br/>{safe(item.get('action'))}",
                styles["CardioXBody"],
            )
        )

    story.append(Spacer(1, 8))
    story.append(Paragraph("Important notice", styles["CardioXSection"]))
    story.append(
        Paragraph(
            "CardioX is an academic prototype and not a certified medical device. This summary should not be used on its own to diagnose or treat a condition.",
            styles["CardioXSmall"],
        )
    )


# --------------------------------------------------
# Clinician Report Builder
# --------------------------------------------------

def build_clinician_report(story, styles, clinician_name, patient, assessment, explainability, advice):
    """
    Builds a detailed clinician-facing report including structured
    inputs, model output, SHAP explanation, and personalised advice.
    """
    story.append(Paragraph("CardioX Clinician Report", styles["CardioXTitle"]))
    story.append(
        Paragraph(
            "Detailed clinical decision-support report including structured inputs, model output, explainability, and advice.",
            styles["CardioXBody"],
        )
    )

    story.append(Spacer(1, 6))

    summary_color = risk_band_color(assessment.get("risk_band"))
    summary_table = Table(
        [
            ["Estimated Risk", f"{safe(assessment.get('risk_percent'))}%"],
            ["Risk Band", safe(assessment.get("risk_band"))],
            ["Assessment Date", format_dt(assessment.get("created_at"))],
            ["Generated By", safe(clinician_name)],
        ],
        colWidths=[60 * mm, 70 * mm],
    )
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#dbe2ef")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dbe2ef")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
                ("TEXTCOLOR", (1, 1), (1, 1), summary_color),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )
    story.append(summary_table)

    story.append(Spacer(1, 12))
    story.append(Paragraph("Patient Summary", styles["CardioXSection"]))
    story.append(
        build_info_table(
            [
                ["Patient ID", safe(patient.get("patient_uid"))],
                ["Name", f"{safe(patient.get('first_name'))} {safe(patient.get('last_name'))}"],
                ["Date of Birth", safe(patient.get("dob"))],
                ["Sex", safe(patient.get("sex"))],
            ]
        )
    )

    story.append(Spacer(1, 12))
    story.append(Paragraph("Structured Clinical Inputs", styles["CardioXSection"]))
    story.append(
        build_info_table(
            [
                ["Age", safe(assessment.get("age"))],
                ["Sex", safe(assessment.get("sex"))],
                ["Chest Pain Type", safe(assessment.get("cp"))],
                ["Resting Blood Pressure", safe(assessment.get("trestbps"))],
                ["Cholesterol", safe(assessment.get("chol"))],
                ["Fasting Blood Sugar", safe(assessment.get("fbs"))],
                ["Rest ECG", safe(assessment.get("restecg"))],
                ["Max Heart Rate", safe(assessment.get("thalch"))],
                ["Exercise-Induced Angina", safe(assessment.get("exang"))],
                ["Oldpeak", safe(assessment.get("oldpeak"))],
                ["ST Segment Slope", safe(assessment.get("slope"))],
                ["Major Vessels (CA)", safe(assessment.get("ca"))],
                ["Thal", safe(assessment.get("thal"))],
            ]
        )
    )

    story.append(Spacer(1, 12))
    story.append(Paragraph("Top SHAP Risk Drivers", styles["CardioXSection"]))

    top_factors = explainability.get("top_factors", []) if explainability else []
    if top_factors:
        for factor in top_factors:
            direction = "Increases risk" if factor.get("direction") == "increases" else "Decreases risk"
            story.append(
                Paragraph(
                    f"<b>{safe(factor.get('display_feature') or nice_feature_name(factor.get('feature')))}</b> "
                    f"({direction})<br/>"
                    f"Value: {safe(factor.get('value'))} | SHAP: {safe(factor.get('shap'))}",
                    styles["CardioXBody"],
                )
            )
    else:
        story.append(Paragraph("No explainability information available.", styles["CardioXBody"]))

    story.append(Spacer(1, 10))
    story.append(Paragraph("Personalised Advice", styles["CardioXSection"]))

    for item in advice[:5]:
        story.append(
            Paragraph(
                f"<b>{safe(item.get('title'))}</b><br/>"
                f"{safe(item.get('reason'))}<br/>"
                f"<b>Action:</b> {safe(item.get('action'))}<br/>"
                f"<b>Source:</b> {safe(item.get('source_label') or item.get('source_name'))}",
                styles["CardioXBody"],
            )
        )

    story.append(Spacer(1, 8))
    story.append(Paragraph("Important notice", styles["CardioXSection"]))
    story.append(
        Paragraph(
            "CardioX is an academic prototype and not a certified medical device. Outputs should be interpreted alongside broader clinical context and professional judgement.",
            styles["CardioXSmall"],
        )
    )


# --------------------------------------------------
# Main PDF Export Entry Point
# --------------------------------------------------

def build_assessment_pdf(
    audience: str,
    clinician_name: str,
    patient: dict,
    assessment: dict,
    explainability: dict,
    advice: list,
) -> bytes:
    """
    Generates the final CardioX PDF report as bytes, choosing either
    a patient-facing or clinician-facing layout based on audience.
    """
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="CardioX Assessment Report",
        author="CardioX",
    )

    styles = build_styles()
    story = []

    audience = (audience or "clinician").strip().lower()

    if audience == "patient":
        build_patient_report(story, styles, clinician_name, patient, assessment, advice)
    else:
        build_clinician_report(
            story,
            styles,
            clinician_name,
            patient,
            assessment,
            explainability,
            advice,
        )

    doc.build(story)
    pdf = buffer.getvalue()
    buffer.close()

    return pdf