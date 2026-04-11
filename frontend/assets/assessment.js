// --------------------------------------------------
// CardioX Assessment Page Script
// --------------------------------------------------

// Handles patient-specific cardiovascular risk assessment workflows,
// including prediction, explainability, advice, reporting, and trend review.


// --------------------------------------------------
// API configuration and authentication
// --------------------------------------------------

const API_BASE = "http://127.0.0.1:8000";
const token = localStorage.getItem("cardiox_token");


// --------------------------------------------------
// Main page elements
// --------------------------------------------------

const patientSummaryEl = document.getElementById("patientSummary");
const btnBack = document.getElementById("btnBack");
const btnLogout = document.getElementById("btnLogout");

const predictForm = document.getElementById("predictForm");
const assessmentHistoryEl = document.getElementById("assessmentHistory");
const statusPredictEl = document.getElementById("statusPredict");
const percentageOfRiskEl = document.getElementById("percentageOfRisk");
const bandOfRiskEl = document.getElementById("bandOfRisk");

const shapFactorsEl = document.getElementById("shapFactors");
const adviceListEl = document.getElementById("adviceList");

const btnLoadExample = document.getElementById("btnLoadExample");
const btnClear = document.getElementById("btnClear");
const btnRecommendation = document.getElementById("btnRecommendation");
const btnExportPatientReport = document.getElementById("btnExportPatientReport");
const btnExportClinicianReport = document.getElementById("btnExportClinicianReport");
const btnGenerateAssessment = document.getElementById("btnGenerateAssessment");

const metricSelectEl = document.getElementById("metricSelect");
const clinicalChartCanvas = document.getElementById("clinicalChart");
const trendSummaryEl = document.getElementById("trendSummary");
const trendInterpretationEl = document.getElementById("trendInterpretation");


// --------------------------------------------------
// Client-side page state
// --------------------------------------------------

let clinicalChart = null;
let cachedAssessments = [];
let selectedPatient = null;
let editingAssessmentId = null;
let refreshAssessmentPinnedPanel = null;


// --------------------------------------------------
// Authentication helpers
// --------------------------------------------------

function authHeaders() {
  // Builds authenticated headers for protected JSON API requests
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };
}

function authHeadersForFile() {
  // Builds authenticated headers for protected file download requests
  return {
    "Authorization": `Bearer ${token}`
  };
}

function forceLogout() {
  // Clears local session data and returns the user to the login page
  localStorage.clear();
  window.location.replace("login.html");
}


// --------------------------------------------------
// Status and UI feedback helpers
// --------------------------------------------------

function setPredictStatus(msg, isError = false) {
  // Updates the prediction status area used throughout the assessment flow
  if (!statusPredictEl) return;

  statusPredictEl.textContent = msg;
  statusPredictEl.style.color = isError ? "#dc2626" : "#475569";
}

function setButtonLoading(button, loadingText, defaultText) {
  // Temporarily disables a button and swaps its label during async actions
  if (!button) return;

  if (loadingText) {
    button.dataset.defaultText = defaultText || button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.defaultText || defaultText || button.textContent;
    button.disabled = false;
  }
}

function renderEmptyState(container, title, message) {
  // Renders a reusable empty-state card for blank content sections
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state-card">
      <strong>${title}</strong>
      <p>${message}</p>
    </div>
  `;
}


// --------------------------------------------------
// Risk band styling helpers
// --------------------------------------------------

function bandStyle(band) {
  // Returns a background colour based on predicted risk band
  if (band === "High") return "rgba(220,38,38,0.14)";
  if (band === "Moderate") return "rgba(245,158,11,0.18)";
  return "rgba(22,163,74,0.14)";
}

function bandTextColor(band) {
  // Returns a text colour based on predicted risk band
  if (band === "High") return "#b91c1c";
  if (band === "Moderate") return "#b45309";
  return "#15803d";
}

function setPredictResult(percentageOfRisk, bandOfRisk) {
  // Updates the main risk result panel after prediction
  if (!percentageOfRiskEl || !bandOfRiskEl) return;

  percentageOfRiskEl.textContent = `${percentageOfRisk}%`;
  bandOfRiskEl.textContent = bandOfRisk;
  bandOfRiskEl.style.background = bandStyle(bandOfRisk);
  bandOfRiskEl.style.color = bandTextColor(bandOfRisk);
}


// --------------------------------------------------
// Date and patient formatting helpers
// --------------------------------------------------

function formatDateTime(iso) {
  // Formats stored timestamps into a UK-friendly datetime string
  if (!iso) return "—";

  const dt = iso.replace("T", " ").slice(0, 19);
  const [datePart, timePart] = dt.split(" ");
  if (!datePart) return iso;

  const [year, month, day] = datePart.split("-");
  return `${day}/${month}/${year}${timePart ? ` ${timePart}` : ""}`;
}

function formatBritishDate(isoDate) {
  // Formats a date string for patient demographic display
  if (!isoDate) return "—";

  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function calcAge(dobStr) {
  // Calculates age from the patient date of birth for model input
  const dob = new Date(dobStr);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function renderPatientSummary(p) {
  // Renders the selected patient summary panel on the assessment page
  if (!patientSummaryEl) return;

  patientSummaryEl.innerHTML = `
    <div class="history-item selected-patient-summary" style="grid-template-columns:1fr;">
      <div class="history-meta">
        <strong>Patient ID:</strong> ${p.patient_uid}<br/>
        <strong>Name:</strong> ${p.first_name} ${p.last_name}<br/>
        <strong>DOB:</strong> ${formatBritishDate(p.dob)}<br/>
        <strong>Sex:</strong> ${p.sex}
      </div>
    </div>
  `;
}

async function loadingTheWelcome() {
  // Loads clinician profile data to personalise the assessment page heading
  try {
    const res = await fetch(`${API_BASE}/profile/me`, { headers: authHeaders() });
    if (!res.ok) return;

    const p = await res.json();
    const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.username;
    const el = document.getElementById("welcomeTitle");

    if (el) {
      el.textContent = `Welcome, ${name} — Clinical Assessment`;
    }
  } catch {}
}


// --------------------------------------------------
// URL parameter helpers
// --------------------------------------------------

function getPatientUidFromUrl() {
  return new URLSearchParams(window.location.search).get("patient_uid");
}

function getAssessmentIdFromUrl() {
  return new URLSearchParams(window.location.search).get("assessment_id");
}


// --------------------------------------------------
// Patient and assessment loading
// --------------------------------------------------

async function loadAssessmentById(assessmentId) {
  // Loads a single saved assessment by ID for editing or review
  const res = await fetch(
    `${API_BASE}/clinician/assessments/${encodeURIComponent(assessmentId)}`,
    { headers: authHeaders() }
  );

  if (res.status === 401 || res.status === 403) {
    forceLogout();
    return null;
  }

  if (!res.ok) return null;
  return await res.json();
}

async function loadPatient(patient_uid) {
  // Loads the selected patient record for the assessment workflow
  const res = await fetch(
    `${API_BASE}/clinician/patients/${encodeURIComponent(patient_uid)}`,
    { headers: authHeaders() }
  );

  if (res.status === 401 || res.status === 403) {
    forceLogout();
    return null;
  }

  if (!res.ok) return null;
  return await res.json();
}

function applyDemographicsToForm(p) {
  // Applies patient age and sex into the form and prevents manual editing
  const age = calcAge(p.dob);
  if (age !== null) predictForm.age.value = age;

  predictForm.sex.value = p.sex;
  predictForm.age.readOnly = true;
  predictForm.sex.disabled = true;
}


// --------------------------------------------------
// Pinned selected patient panel
// --------------------------------------------------

function pinAssessmentSelectedPatientPanel() {
  // Keeps the selected patient summary panel pinned during scrolling on large screens
  const panel = document.getElementById("assessmentSelectedPatientPanel");
  const spacer = document.getElementById("assessmentSelectedPatientSpacer");
  const rightColumn = document.querySelector(".assessment-right-column");

  if (!panel || !spacer || !rightColumn) return;

  let initialTop = null;

  function updatePinnedPanel() {
    panel.classList.remove("is-pinned");
    spacer.classList.remove("active");
    rightColumn.classList.remove("is-pinned-layout");

    panel.style.top = "";
    panel.style.left = "";
    panel.style.width = "";
    panel.style.maxHeight = "";
    panel.style.overflowY = "";
    spacer.style.height = "";

    if (window.innerWidth <= 1100) {
      return;
    }

    const columnRect = rightColumn.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const navbarOffset = 108;
    const panelGap = 28;

    if (initialTop === null) {
      initialTop = panelRect.top;
    }

    const finalTop = Math.max(initialTop, navbarOffset);

    spacer.classList.add("active");
    spacer.style.height = `${panel.offsetHeight + panelGap}px`;

    panel.classList.add("is-pinned");
    rightColumn.classList.add("is-pinned-layout");

    panel.style.top = `${finalTop}px`;
    panel.style.left = `${columnRect.left}px`;
    panel.style.width = `${rightColumn.offsetWidth}px`;
    panel.style.maxHeight = `calc(100vh - ${finalTop + 24}px)`;
    panel.style.overflowY = "auto";
  }

  let resizeTimeout;

  function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      initialTop = null;
      updatePinnedPanel();
    }, 80);
  }

  refreshAssessmentPinnedPanel = () => {
    requestAnimationFrame(() => {
      updatePinnedPanel();
    });
  };

  refreshAssessmentPinnedPanel();
  window.addEventListener("resize", handleResize);
  window.addEventListener("load", refreshAssessmentPinnedPanel);
}


// --------------------------------------------------
// Navigation and top button actions
// --------------------------------------------------

btnBack?.addEventListener("click", () => {
  window.location.href = "clinician.html";
});

btnLogout?.addEventListener("click", forceLogout);

btnRecommendation?.addEventListener("click", () => {
  // Scrolls directly to the recommendation section after results are shown
  document.getElementById("adviceSection")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});


// --------------------------------------------------
// Protected PDF export
// --------------------------------------------------

async function openProtectedPdf(url) {
  // Requests a protected PDF endpoint using the current bearer token
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: authHeadersForFile()
    });

    if (res.status === 401 || res.status === 403) {
      forceLogout();
      return;
    }

    if (!res.ok) {
      setPredictStatus("Failed to export report.", true);
      return;
    }

    const blob = await res.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    window.open(objectUrl, "_blank");

    setTimeout(() => {
      window.URL.revokeObjectURL(objectUrl);
    }, 10000);
  } catch {
    setPredictStatus("Network error while exporting report.", true);
  }
}

btnExportPatientReport?.addEventListener("click", async () => {
  if (!editingAssessmentId) {
    return setPredictStatus("Create or load an assessment first before exporting.", true);
  }

  setButtonLoading(btnExportPatientReport, "Opening Report...", "Export Report for Patient");

  await openProtectedPdf(
    `${API_BASE}/clinician/assessments/${encodeURIComponent(editingAssessmentId)}/report.pdf?audience=patient`
  );

  setButtonLoading(btnExportPatientReport, null, "Export Report for Patient");
});

btnExportClinicianReport?.addEventListener("click", async () => {
  if (!editingAssessmentId) {
    return setPredictStatus("Create or load an assessment first before exporting.", true);
  }

  setButtonLoading(btnExportClinicianReport, "Opening Report...", "Export Report for Clinician");

  await openProtectedPdf(
    `${API_BASE}/clinician/assessments/${encodeURIComponent(editingAssessmentId)}/report.pdf?audience=clinician`
  );

  setButtonLoading(btnExportClinicianReport, null, "Export Report for Clinician");
});


// --------------------------------------------------
// Example and form reset actions
// --------------------------------------------------

btnLoadExample?.addEventListener("click", () => {
  // Loads example clinical values to demonstrate the assessment workflow
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

btnClear?.addEventListener("click", () => {
  // Clears assessment inputs while preserving fixed demographic fields
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

  percentageOfRiskEl.textContent = "—";
  bandOfRiskEl.textContent = "—";
  bandOfRiskEl.style.background = "";
  bandOfRiskEl.style.color = "";

  setPredictStatus("Form cleared (age and sex kept).");
  renderShap(null);
  renderAdvice(null);
});


// --------------------------------------------------
// Explainability and advice rendering
// --------------------------------------------------

function prettifyFeatureName(name) {
  // Converts model feature keys into clinician-friendly labels
  const map = {
    trestbps: "Resting Blood Pressure",
    chol: "Cholesterol",
    thalch: "Max Heart Rate",
    exang: "Exercise-Induced Angina",
    oldpeak: "Oldpeak",
    restecg: "Rest ECG",
    fbs: "Fasting Blood Sugar",
    cp: "Chest Pain Type",
    slope: "ST Segment Slope",
    ca: "Major Vessels (CA)",
    age: "Age",
    sex: "Sex",
    thal: "Thal"
  };

  return map[name] || name;
}

function renderShap(xai) {
  // Renders SHAP-based top risk factors for the current assessment
  if (!shapFactorsEl) return;

  if (!xai) {
    renderEmptyState(
      shapFactorsEl,
      "No explainability yet",
      "Run a prediction to view the top risk drivers for this assessment."
    );
    return;
  }

  const factors = xai?.top_factors || [];
  if (!factors.length) {
    renderEmptyState(
      shapFactorsEl,
      "No explainability available",
      "CardioX could not generate SHAP feature contributions for this assessment."
    );
    return;
  }

  const maxAbs = Math.max(...factors.map((f) => Math.abs(Number(f.shap) || 0))) || 1;

  shapFactorsEl.innerHTML = factors
    .map((f) => {
      const featureLabel = f.display_feature || prettifyFeatureName(f.feature);
      const isIncrease = f.direction === "increases";
      const width = (Math.abs(Number(f.shap) || 0) / maxAbs) * 100;

      return `
        <div class="shap-row">
          <div class="shap-row-top">
            <div class="shap-feature">${featureLabel}</div>
            <div class="shap-direction ${isIncrease ? "inc" : "dec"}">
              ${isIncrease ? "▲ Increasing risk" : "▼ Decreasing risk"}
            </div>
          </div>

          <div class="shap-bar-bg">
            <div class="shap-bar ${isIncrease ? "inc" : "dec"}" style="width:${width}%"></div>
          </div>

          <div class="shap-row-meta">
            Value: <strong>${f.value ?? "—"}</strong> • Impact: ${f.shap}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderAdvice(items) {
  // Renders personalised recommendation cards generated for the assessment
  if (!adviceListEl) return;

  if (!items) {
    renderEmptyState(
      adviceListEl,
      "No advice yet",
      "Generate a risk assessment to view source-backed personalised advice."
    );
    return;
  }

  if (!items.length) {
    renderEmptyState(
      adviceListEl,
      "No advice available",
      "No source-backed advice items were generated for this assessment."
    );
    return;
  }

  adviceListEl.innerHTML = items
    .map(
      (a) => `
    <div class="advice-card premium-advice-card">
      <div class="advice-card-top">
        <div>
          <h3>${a.title}</h3>
          <p class="advice-reason">${a.reason}</p>
        </div>
        <span class="advice-source-badge">${a.source_name || "Guidance"}</span>
      </div>

      <div class="advice-action-box">
        <strong>Recommended action</strong>
        <p>${a.action}</p>
      </div>

      <div class="advice-footer">
        ${
          a.source_url
            ? `<a href="${a.source_url}" target="_blank" rel="noopener noreferrer" class="inline-link">${a.source_label || "View source"}</a>`
            : `<span class="advice-source-text">${a.source_label || "Verified guidance source"}</span>`
        }
      </div>
    </div>
  `
    )
    .join("");
}


// --------------------------------------------------
// Trend chart configuration
// --------------------------------------------------

const METRIC_META = {
  trestbps: { label: "Resting Blood Pressure", unit: "mmHg" },
  chol: { label: "Total Cholesterol", unit: "mmol/L" },
  thalch: { label: "Max Heart Rate", unit: "bpm" },
  oldpeak: { label: "Oldpeak (ST Depression)", unit: "" },
  ca: { label: "CA (Vessels)", unit: "" },
  risk_percent: { label: "Predicted Risk", unit: "%" }
};

const NHS_REFERENCE = {
  trestbps: { label: "Reference", value: 120 },
  chol: { label: "Reference", value: 5.0 },
  oldpeak: { label: "Reference", value: 1.0 },
  ca: { label: "Reference", value: 0 },
  risk_percent: { label: "Reference", value: 30 }
};

function mgDlToMmol(value) {
  // Converts cholesterol values for UK clinical chart presentation
  if (value === null || value === undefined || value === "") return null;

  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  return +(n / 38.67).toFixed(2);
}

function parseDateLabel(iso) {
  // Creates chart-friendly date labels from assessment timestamps
  if (!iso) return "";

  const date = iso.slice(0, 10);
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function getReferenceForMetric(metric, row) {
  // Returns the relevant comparison reference line for the selected metric
  if (metric === "thalch") {
    const age = Number(row?.age);
    if (!Number.isFinite(age)) return null;
    return Math.round((220 - age) * 0.85);
  }

  return NHS_REFERENCE[metric]?.value ?? null;
}

function getDisplayValue(metric, row) {
  // Normalises stored assessment values for chart display
  if (!row) return null;

  if (metric === "chol") return mgDlToMmol(row.chol);

  const v = row?.[metric];
  if (v === null || v === undefined || v === "") return null;

  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getMetricPadding(metric) {
  // Adds a metric-specific padding value to improve chart readability
  const map = {
    trestbps: 10,
    chol: 0.6,
    thalch: 8,
    oldpeak: 0.4,
    ca: 0.5,
    risk_percent: 4
  };

  return map[metric] ?? 5;
}

function ensureChart() {
  // Creates the Chart.js instance once and reuses it for metric switching
  if (!clinicalChartCanvas || typeof Chart === "undefined") return null;
  if (clinicalChart) return clinicalChart;

  const ctx = clinicalChartCanvas.getContext("2d");

  clinicalChart = new Chart(ctx, {
    type: "line",
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: {
            boxWidth: 18,
            boxHeight: 8,
            padding: 16,
            font: {
              size: 12,
              weight: "600"
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          title: { display: true, text: "" },
          ticks: {
            font: { size: 11 }
          }
        },
        x: {
          title: { display: true, text: "Assessment Date" },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            font: { size: 11 }
          }
        }
      }
    }
  });

  return clinicalChart;
}

function renderTrendSummary(metric, latestValue, referenceValue, meta) {
  // Renders a textual interpretation of the latest trend value versus reference
  if (!trendSummaryEl) return;

  if (latestValue === null || latestValue === undefined) {
    renderEmptyState(
      trendSummaryEl,
      "No trend data available",
      "Trend summary will appear when assessment history is available for the selected metric."
    );

    if (trendInterpretationEl) {
      trendInterpretationEl.textContent = "Select a metric to view a short interpretation.";
    }
    return;
  }

  let interpretation = "No reference available";
  let interpretationSentence = `${meta.label} has been recorded, but no comparison reference is available.`;
  let deltaText = "—";

  if (referenceValue !== null && referenceValue !== undefined) {
    const delta = +(latestValue - referenceValue).toFixed(2);
    const absDelta = Math.abs(delta);

    if (delta > 0) {
      interpretation = "Above reference";
      deltaText = `+${absDelta}${meta.unit ? ` ${meta.unit}` : ""}`;
      interpretationSentence = `Latest ${meta.label.toLowerCase()} is above the reference level. Interpret this alongside the patient’s wider clinical context.`;
    } else if (delta < 0) {
      interpretation = "Below reference";
      deltaText = `-${absDelta}${meta.unit ? ` ${meta.unit}` : ""}`;
      interpretationSentence = `Latest ${meta.label.toLowerCase()} is below the reference level. This should be interpreted together with other assessment findings.`;
    } else {
      interpretation = "At reference";
      deltaText = `0${meta.unit ? ` ${meta.unit}` : ""}`;
      interpretationSentence = `Latest ${meta.label.toLowerCase()} is aligned with the reference level.`;
    }
  }

  trendSummaryEl.innerHTML = `
    <div class="trend-summary-grid">
      <div class="trend-summary-block">
        <span class="trend-summary-label">Latest value</span>
        <strong>${latestValue}${meta.unit ? ` ${meta.unit}` : ""}</strong>
        <span class="trend-summary-subvalue">${meta.label}</span>
      </div>

      <div class="trend-summary-block">
        <span class="trend-summary-label">Reference</span>
        <strong>${referenceValue ?? "—"}${meta.unit && referenceValue !== null ? ` ${meta.unit}` : ""}</strong>
        <span class="trend-summary-subvalue">Comparison line</span>
      </div>

      <div class="trend-summary-block">
        <span class="trend-summary-label">Difference</span>
        <strong>${deltaText}</strong>
        <span class="trend-summary-subvalue">${interpretation}</span>
      </div>
    </div>
  `;

  if (trendInterpretationEl) {
    trendInterpretationEl.textContent = interpretationSentence;
  }
}

function updateClinicalChart(metric) {
  // Updates the longitudinal clinical chart using cached patient assessment history
  const chart = ensureChart();
  if (!chart) return;

  const items = [...(cachedAssessments || [])].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  const labels = items.map((a) => parseDateLabel(a.created_at));
  const patientValues = items.map((a) => getDisplayValue(metric, a));
  const refValues = items.map((a) => {
    const v = getReferenceForMetric(metric, a);
    return v === null || v === undefined ? null : Number(v);
  });

  const meta = METRIC_META[metric] || { label: metric, unit: "" };
  chart.options.scales.y.title.text = meta.unit ? `${meta.label} (${meta.unit})` : meta.label;

  chart.data.labels = labels;
  chart.data.datasets = [
    {
      label: `${meta.label} (Patient)`,
      data: patientValues,
      spanGaps: true,
      tension: 0.28,
      borderWidth: 3,
      pointRadius: 4,
      pointHoverRadius: 6
    },
    ...(refValues.some((v) => v !== null)
      ? [
          {
            label: "Reference",
            data: refValues,
            spanGaps: true,
            borderDash: [6, 6],
            tension: 0,
            borderWidth: 2,
            pointRadius: 0
          }
        ]
      : [])
  ];

  const allValues = [...patientValues, ...refValues].filter((v) => Number.isFinite(v));

  if (allValues.length) {
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const padding = getMetricPadding(metric);

    let yMin = +(min - padding).toFixed(2);
    let yMax = +(max + padding).toFixed(2);

    if (Math.abs(yMax - yMin) < padding * 2) {
      yMin = +(yMin - padding).toFixed(2);
      yMax = +(yMax + padding).toFixed(2);
    }

    if (["chol", "oldpeak", "ca", "risk_percent", "trestbps", "thalch"].includes(metric)) {
      yMin = Math.max(0, yMin);
    }

    chart.options.scales.y.min = yMin;
    chart.options.scales.y.max = yMax;
  }

  chart.update();

  const latestRow = items.length ? items[items.length - 1] : null;
  const latestValue = latestRow ? getDisplayValue(metric, latestRow) : null;
  const latestReference = latestRow ? getReferenceForMetric(metric, latestRow) : null;

  renderTrendSummary(metric, latestValue, latestReference, meta);
}

metricSelectEl?.addEventListener("change", () => {
  updateClinicalChart(metricSelectEl.value);
});


// --------------------------------------------------
// Assessment submission workflow
// --------------------------------------------------

predictForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!selectedPatient) {
    return setPredictStatus("No patient loaded.", true);
  }

  setPredictStatus("Predicting and saving assessment...");
  setButtonLoading(btnGenerateAssessment, "Generating...", "Generate Risk Assessment");

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
    url = `${API_BASE}/clinician/assessments/${encodeURIComponent(editingAssessmentId)}`;
    method = "PUT";
  } else {
    url = `${API_BASE}/clinician/patients/${encodeURIComponent(patient_uid)}/assessments`;
    method = "POST";
  }

  try {
    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });

    if (res.status === 401 || res.status === 403) {
      forceLogout();
      return;
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data.detail, null, 2);

      setPredictStatus(msg || `Prediction failed (${res.status}).`, true);
      return;
    }

    setPredictResult(data.prediction.risk_percent, data.prediction.risk_band);
    renderShap(data.explainability ?? null);
    renderAdvice(data.advice ?? null);

    if (editingAssessmentId) {
      setPredictStatus("Assessment updated.");
    } else {
      if (data.assessment?.created_at) {
        setPredictStatus(`Saved assessment at ${formatDateTime(data.assessment.created_at)}`);
      } else {
        setPredictStatus("Assessment saved.");
      }

      if (data.assessment?.id) {
        editingAssessmentId = data.assessment.id;
        const newUrl = `assessment.html?patient_uid=${encodeURIComponent(
          patient_uid
        )}&assessment_id=${encodeURIComponent(editingAssessmentId)}`;

        window.history.replaceState({}, "", newUrl);
      }
    }

    await loadAssessmentHistory(patient_uid);
  } catch (err) {
    console.error(err);
    setPredictStatus("Network error calling API.", true);
  } finally {
    setButtonLoading(btnGenerateAssessment, null, "Generate Risk Assessment");
  }
});


// --------------------------------------------------
// Assessment loading and deletion
// --------------------------------------------------

function loadAssessmentIntoForm(a) {
  // Loads a saved assessment into the form for review or update
  if (!predictForm) return;

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

  if (typeof a.risk_percent !== "undefined" && a.risk_percent !== null) {
    setPredictResult(a.risk_percent, a.risk_band);
  }

  setPredictStatus(`Loaded assessment from ${formatDateTime(a.created_at)}.`);
  renderShap(null);
  renderAdvice(null);
}

async function deleteAssessment(assessmentId) {
  // Deletes a saved assessment and refreshes patient history
  const ok = confirm("Delete this assessment record?");
  if (!ok) return;

  try {
    const res = await fetch(
      `${API_BASE}/clinician/assessments/${encodeURIComponent(assessmentId)}`,
      {
        method: "DELETE",
        headers: authHeaders()
      }
    );

    if (res.status === 401 || res.status === 403) {
      forceLogout();
      return;
    }

    if (!res.ok) {
      setPredictStatus("Delete failed.", true);
      return;
    }

    if (String(editingAssessmentId) === String(assessmentId)) {
      editingAssessmentId = null;

      const newUrl = `assessment.html?patient_uid=${encodeURIComponent(
        selectedPatient.patient_uid
      )}`;

      window.history.replaceState({}, "", newUrl);
      renderShap(null);
      renderAdvice(null);

      percentageOfRiskEl.textContent = "—";
      bandOfRiskEl.textContent = "—";
      bandOfRiskEl.style.background = "";
      bandOfRiskEl.style.color = "";
    }

    setPredictStatus("Assessment deleted.");
    await loadAssessmentHistory(selectedPatient.patient_uid);
  } catch {
    setPredictStatus("Network error while deleting assessment.", true);
  }
}


// --------------------------------------------------
// Assessment history rendering
// --------------------------------------------------

function renderAssessmentHistory(items) {
  // Renders the saved assessment history for the current patient
  if (!assessmentHistoryEl) return;

  if (!items || items.length === 0) {
    renderEmptyState(
      assessmentHistoryEl,
      "No previous assessments",
      "This patient does not yet have any saved assessment history."
    );

    if (typeof refreshAssessmentPinnedPanel === "function") {
      refreshAssessmentPinnedPanel();
    }

    return;
  }

  assessmentHistoryEl.innerHTML = items
    .map(
      (a) => `
    <div class="history-item">
      <div class="assessment-history-main">
        <div class="history-meta">
          <strong>${formatDateTime(a.created_at)}</strong><br/>
          Assessment ID: ${a.id}
        </div>
      </div>

      <div class="assessment-history-right">
        <div class="history-risk">${a.risk_percent}%</div>
        <div class="history-band" style="background:${bandStyle(a.risk_band)};color:${bandTextColor(a.risk_band)};">
          ${a.risk_band}
        </div>
      </div>

      <div class="assessment-history-actions">
        <button type="button" class="primary" data-edit-assessment="${a.id}">Open</button>
        <button type="button" class="danger" data-delete-assessment="${a.id}">Delete</button>
      </div>
    </div>
  `
    )
    .join("");

  document.querySelectorAll("[data-edit-assessment]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-edit-assessment");
      const a = items.find((x) => String(x.id) === String(id));
      if (!a) return;

      loadAssessmentIntoForm(a);
      editingAssessmentId = a.id;

      const newUrl = `assessment.html?patient_uid=${encodeURIComponent(
        selectedPatient.patient_uid
      )}&assessment_id=${encodeURIComponent(editingAssessmentId)}`;

      window.history.replaceState({}, "", newUrl);

      const metric = metricSelectEl?.value || "trestbps";
      updateClinicalChart(metric);
    });
  });

  document.querySelectorAll("[data-delete-assessment]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-delete-assessment");
      await deleteAssessment(id);
    });
  });

  if (typeof refreshAssessmentPinnedPanel === "function") {
    refreshAssessmentPinnedPanel();
  }
}

async function loadAssessmentHistory(patient_uid) {
  // Loads all historical assessments for the selected patient
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
  cachedAssessments = items || [];

  const metric = metricSelectEl?.value || "trestbps";
  updateClinicalChart(metric);
  renderAssessmentHistory(items);
}


// --------------------------------------------------
// Initial page load
// --------------------------------------------------

(async function init() {
  // Initialises the assessment page using URL parameters and stored session data
  renderShap(null);
  renderAdvice(null);

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
      `<p class="note">Patient not found. Go back to patient management.</p>`;
    return;
  }

  selectedPatient = p;
  renderPatientSummary(p);
  applyDemographicsToForm(p);

  await loadAssessmentHistory(patient_uid);

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