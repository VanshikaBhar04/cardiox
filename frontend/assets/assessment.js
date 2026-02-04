// Base URL for FastAPI backend 
const API_BASE = "http://127.0.0.1:8000";
// JWT tocken for authenticated clinician calls
const token = localStorage.getItem("cardiox_token");

const patientSummaryEl = document.getElementById("patientSummary");
const btnBack = document.getElementById("btnBack");
const btnLogout = document.getElementById("btnLogout");

// editingAssessmentId = set when editing existing assessment (PUT) vs creating new (POST)
const predictForm = document.getElementById("predictForm");
const assessmentHistoryEl = document.getElementById("assessmentHistory");
const statusPredictEl = document.getElementById("statusPredict");
const percentageOfRiskEl = document.getElementById("percentageOfRisk");
const bandOfRiskEl = document.getElementById("bandOfRisk");

const btnLoadExample = document.getElementById("btnLoadExample");
const btnClear = document.getElementById("btnClear");

const btnRecommendation = document.getElementById("btnRecommendation");
const btnExportReport = document.getElementById("btnExportReport");

let selectedPatient = null;
let editingAssessmentId = null;

// Build authenticated headers for clinician requests
function authHeaders() {
  return { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
}

// Clearing sessions and redirecting back to the login page
function forceLogout() {
  localStorage.clear();
  window.location.replace("login.html");
}

// Showing prediction status underneath the form, once submitted
function setPredictStatus(msg, isError = false) {
  if (!statusPredictEl) return;
  statusPredictEl.textContent = msg;
  statusPredictEl.style.color = isError ? "#dc2626" : "#475569";
}

// Background colour for the risk band pill
function bandStyle(band) {
  if (band === "High") return "rgba(220,38,38,0.18)";
  if (band === "Moderate") return "rgba(245,158,11,0.22)";
  return "rgba(22,163,74,0.18)";
}

// Displaying predicted risk % and band on the UI
function setPredictResult(percentageOfRisk, bandOfRisk) {
  percentageOfRiskEl.textContent = `${percentageOfRisk}%`;
  bandOfRiskEl.textContent = bandOfRisk;
  bandOfRiskEl.style.background = bandStyle(bandOfRisk);
}

// Calculating the age from the DOB (This is an auto-filled field)
function calcAge(dobStr) {
  const dob = new Date(dobStr);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// Page Loading Helpers:

// Rendering the selected patient summary card at the top
function renderPatientSummary(p) {
  patientSummaryEl.innerHTML = `
    <div class="history-item" style="grid-template-columns:1fr;">
      <div class="history-meta">
        <strong>Patient ID:</strong> ${p.patient_uid}<br/>
        <strong>Name:</strong> ${p.first_name} ${p.last_name}<br/>
        <strong>DOB:</strong> ${p.dob}<br/>
        <strong>Sex:</strong> ${p.sex}
      </div>
    </div>`;
}
// Fetch the clinician's profile + show welcome name
async function loadingTheWelcome() {
  try {
    const res = await fetch(`${API_BASE}/profile/me`, { headers: authHeaders() });
    if (!res.ok) return;
    const p = await res.json();
    const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.username;
    const el = document.getElementById("welcomeTitle");
    if (el) el.textContent = `Welcome, ${name} — Clinical Assessment`;
  } catch {}
}
// Read patient_uid from the query string 
function getPatientUidFromUrl() {
  return new URLSearchParams(window.location.search).get("patient_uid");
}

// Read assessment_id from query string (edit mode)
function getAssessmentIdFromUrl() {
  return new URLSearchParams(window.location.search).get("assessment_id");
}

// Loading a full assessment record by ID for editing
async function loadAssessmentById(assessmentId) {
  const res = await fetch(
    `${API_BASE}/clinician/assessments/${encodeURIComponent(assessmentId)}`,
    { headers: authHeaders() }
  );

  if (res.status === 401 || res.status === 403) return forceLogout();
  if (!res.ok) return null;
  return await res.json();
}

// Loading a patient by their unique ID
async function loadPatient(patient_uid) {
  const res = await fetch(`${API_BASE}/clinician/patients/${encodeURIComponent(patient_uid)}`, { headers: authHeaders() });
  if (res.status === 401 || res.status === 403) return forceLogout();
  if (!res.ok) return null;
  return await res.json();
}
// Auto-filling the age and sex column and then disabling them for being edited
function applyDemographicsToForm(p) {
  const age = calcAge(p.dob);
  if (age !== null) predictForm.age.value = age;
  predictForm.sex.value = p.sex;

  predictForm.age.readOnly = true;
  predictForm.sex.disabled = true;
}

btnBack?.addEventListener("click", () => window.location.href = "clinician.html");
btnLogout?.addEventListener("click", forceLogout);

// Buttons shown only for now
btnRecommendation?.addEventListener("click", () => alert("Recommendation feature coming soon."));
btnExportReport?.addEventListener("click", () => alert("Export report feature coming soon."));

// Loading example values to demo prediction values
btnLoadExample?.addEventListener("click", () => {
  predictForm.cp.value = "typical angina";
  predictForm.trestbps.value = 140;
  predictForm.chol.value = 240;
  predictForm.fbs.value = "False";
  predictForm.restecg.value = "normal";
  predictForm.thalch.value = 150;
  predictForm.exang.value = "False";
  predictForm.oldpeak.value = 1.2;
  predictForm.slope.value = "flat";
  predictForm.ca.value = 0;
  predictForm.thal.value = "normal";
  setPredictStatus("Example clinical values loaded.");
});

// Clearing the clinical inputs but not changing the sex and age
btnClear?.addEventListener("click", () => {
  predictForm.cp.value = "";
  predictForm.trestbps.value = "";
  predictForm.chol.value = "";
  predictForm.fbs.value = "";
  predictForm.restecg.value = "";
  predictForm.thalch.value = "";
  predictForm.exang.value = "";
  predictForm.oldpeak.value = "";
  predictForm.slope.value = "";
  predictForm.ca.value = "";
  predictForm.thal.value = "";
  setPredictResult("—", "—");
  setPredictStatus("Form cleared (age/sex kept).");
});

/** Submit clinical form:
 * - If editingAssessmentId exists → PUT update existing assessment
 * - Else → POST create new assessment
 * After success: show prediction + update URL into edit mode
 */
predictForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selectedPatient) return setPredictStatus("No patient loaded.", true);

  setPredictStatus("Predicting and saving assessment...");

  const patient_uid = selectedPatient.patient_uid;
  const payload = {
    age: Number(predictForm.age.value),
    sex: selectedPatient.sex,
    cp: predictForm.cp.value,
    trestbps: predictForm.trestbps.value ? Number(predictForm.trestbps.value) : null,
    chol: predictForm.chol.value ? Number(predictForm.chol.value) : null,
    fbs: predictForm.fbs.value,
    restecg: predictForm.restecg.value,
    thalch: predictForm.thalch.value ? Number(predictForm.thalch.value) : null,
    exang: predictForm.exang.value,
    oldpeak: predictForm.oldpeak.value ? Number(predictForm.oldpeak.value) : null,
    slope: predictForm.slope.value,
    ca: predictForm.ca.value ? Number(predictForm.ca.value) : null,
    thal: predictForm.thal.value
  };

let url = "";
let method = "";

if (editingAssessmentId) {
  // UPDATE existing assessment
  url = `${API_BASE}/clinician/assessments/${encodeURIComponent(editingAssessmentId)}`;
  method = "PUT";
} else {
  // CREATE new assessment
  url = `${API_BASE}/clinician/patients/${encodeURIComponent(patient_uid)}/assessments`;
  method = "POST";
}

  const res = await fetch(url, {
  method,
  headers: authHeaders(),
  body: JSON.stringify(payload)
});


const data = await res.json().catch(() => ({}));

if (res.status === 401 || res.status === 403) return forceLogout();

if (!res.ok) {
  const msg = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail, null, 2);
  return setPredictStatus(msg || `Prediction failed (${res.status}).`, true);
}

if (editingAssessmentId) {
  // PUT response: { updated: true, prediction: {...} }
  setPredictResult(data.prediction.risk_percent, data.prediction.risk_band);
  setPredictStatus("Assessment updated.");
} else {
  // POST response: { assessment: {...}, prediction: {...} }
  setPredictResult(data.prediction.risk_percent, data.prediction.risk_band);

  if (data.assessment?.created_at) {
    setPredictStatus(`Saved assessment at ${data.assessment.created_at.replace("T", " ").slice(0, 19)}`);
  } else {
    setPredictStatus("Assessment saved.");
  }

  // Switch into edit mode for the newly created assessment
  if (data.assessment?.id) {
    editingAssessmentId = data.assessment.id;
    const newUrl = `assessment.html?patient_uid=${encodeURIComponent(patient_uid)}&assessment_id=${encodeURIComponent(editingAssessmentId)}`;
    window.history.replaceState({}, "", newUrl);
  }
}

// Refresh history list
await loadAssessmentHistory(patient_uid);

});

// Formatting the timestamp for assessment history displau
function formatDateTime(iso) {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 19);
}

// Rendering assessment list and allowing click to load one into the form
function renderAssessmentHistory(items) {
  if (!assessmentHistoryEl) return;

  if (!items || items.length === 0) {
    assessmentHistoryEl.innerHTML = `<p class="note">No previous assessments for this patient.</p>`;
    return;
  }

  assessmentHistoryEl.innerHTML = items.map(a => `
    <div class="history-item clickable" data-assessment-id="${a.id}" style="grid-template-columns: 1fr auto auto;">
      <div class="history-meta">
        <strong>${formatDateTime(a.created_at)}</strong><br/>
        Assessment ID: ${a.id}
      </div>
      <div class="history-risk">${a.risk_percent}%</div>
      <div class="history-band">${a.risk_band}</div>
    </div>
  `).join("");

  // click to load values back into the form
document.querySelectorAll("[data-assessment-id]").forEach(el => {
  el.addEventListener("click", () => {
    const id = el.getAttribute("data-assessment-id");
    const a = items.find(x => String(x.id) === String(id));

    if (!a) return;

    loadAssessmentIntoForm(a);

    // set edit mode + update URL
    editingAssessmentId = a.id;
    const newUrl = `assessment.html?patient_uid=${encodeURIComponent(selectedPatient.patient_uid)}&assessment_id=${encodeURIComponent(editingAssessmentId)}`;
    window.history.replaceState({}, "", newUrl);
  });
});

}

// Load an assessment record’s clinical fields back into the form
function loadAssessmentIntoForm(a) {
  if (!predictForm) return;

  // Age/Sex come from patient record; keep them locked
  // Fill other clinical inputs
  predictForm.cp.value = a.cp ?? "";
  predictForm.trestbps.value = a.trestbps ?? "";
  predictForm.chol.value = a.chol ?? "";
  predictForm.fbs.value = a.fbs ?? "";
  predictForm.restecg.value = a.restecg ?? "";
  predictForm.thalch.value = a.thalch ?? "";
  predictForm.exang.value = a.exang ?? "";
  predictForm.oldpeak.value = a.oldpeak ?? "";
  predictForm.slope.value = a.slope ?? "";
  predictForm.ca.value = a.ca ?? "";
  predictForm.thal.value = a.thal ?? "";

  // Show the result from that saved assessment as well
  if (typeof a.risk_percent !== "undefined" && a.risk_percent !== null) {
    setPredictResult(a.risk_percent, a.risk_band);
    setPredictStatus(`Loaded assessment from ${formatDateTime(a.created_at)}.`);
  } else {
    setPredictStatus(`Loaded assessment from ${formatDateTime(a.created_at)}.`);
  }
}
// Fetching the assessment history list for a patient
async function loadAssessmentHistory(patient_uid) {
  if (!assessmentHistoryEl) return;

  assessmentHistoryEl.innerHTML = `<p class="note">Loading assessments…</p>`;

  const res = await fetch(
    `${API_BASE}/clinician/patients/${encodeURIComponent(patient_uid)}/assessments?limit=50`,
    { headers: authHeaders() }
  );

  if (res.status === 401 || res.status === 403) {
    forceLogout();
    return;
  }

  if (!res.ok) {
    assessmentHistoryEl.innerHTML = `<p class="note">Failed to load assessments.</p>`;
    return;
  }

  const items = await res.json();
  renderAssessmentHistory(items);
}

(async function init() {
  loadingTheWelcome();

  const patient_uid = getPatientUidFromUrl();
  if (!patient_uid) {
    patientSummaryEl.innerHTML =
      `<p class="note">Missing patient_uid in URL. Go back and select a patient.</p>`;
    return;
  }

  const p = await loadPatient(patient_uid);
  if (!p) {
    patientSummaryEl.innerHTML =
      `<p class="note">Patient not found. Go back to dashboard.</p>`;
    return;
  }

  selectedPatient = p;
  renderPatientSummary(p);
  applyDemographicsToForm(p);

  // Load assessment history list
  await loadAssessmentHistory(patient_uid);

  // If editing, load the specific assessment into the form
  const assessmentId = getAssessmentIdFromUrl();
  editingAssessmentId = assessmentId;

  if (assessmentId) {
    const a = await loadAssessmentById(assessmentId);
    if (a) {
      loadAssessmentIntoForm(a);
    } else {
      setPredictStatus("Failed to load assessment.", true);
    }
  }
})();
