// --- Auth guard: require login ---
const token = localStorage.getItem("cardiox_token");
if (!token) {
  window.location.href = "login.html";
}

const API_URL = "http://127.0.0.1:8000/predict";
const HISTORY_URL = "http://127.0.0.1:8000/predictions";


const form = document.getElementById("predictForm");
const statusEl = document.getElementById("status");
const percentageOfRiskEl = document.getElementById("percentageOfRisk");
const bandOfRiskEl = document.getElementById("bandOfRisk");

const btnLoadExample = document.getElementById("btnLoadExample");
const btnClear = document.getElementById("btnClear");

const btnLoadHistory = document.getElementById("btnLoadHistory");
const historyEl = document.getElementById("history");


// ----- These are helper Functions ----- 

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#ff6b6b" : "#aab4e6";
}

function setResult(percentageOfRisk, bandOfRisk) {
  percentageOfRiskEl.textContent = `${percentageOfRisk}%`;
  bandOfRiskEl.textContent = bandOfRisk;

  bandOfRiskEl.style.background =
    bandOfRisk === "High"
      ? "rgba(255,107,107,0.25)"
      : bandOfRisk === "Moderate"
      ? "rgba(255,212,59,0.25)"
      : "rgba(105,219,124,0.25)";
}


// ----- Used to Load an example patient ----- 

btnLoadExample.addEventListener("click", () => {
  form.age.value = 63;
  form.sex.value = "Male";
  form.cp.value = "typical angina";
  form.trestbps.value = 145;
  form.chol.value = 233;
  form.fbs.value = "False";
  form.restecg.value = "lv hypertrophy";
  form.thalch.value = 150;
  form.exang.value = "False";
  form.oldpeak.value = 2.3;
  form.slope.value = "downsloping";
  form.ca.value = 0;
  form.thal.value = "fixed defect";

  setStatus("Example patient loaded.");
});


// ----- Clearing the form ----- 

btnClear.addEventListener("click", () => {
  form.reset();
  percentageOfRiskEl.textContent = "—";
  bandOfRiskEl.textContent = "—";
  setStatus("");
});


// ----- Submitting and then calling the API ----- 

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("Predicting risk...");

  const data = {
    age: Number(form.age.value),
    sex: form.sex.value,
    cp: form.cp.value,
    trestbps: form.trestbps.value ? Number(form.trestbps.value) : null,
    chol: form.chol.value ? Number(form.chol.value) : null,
    fbs: form.fbs.value,
    restecg: form.restecg.value,
    thalch: form.thalch.value ? Number(form.thalch.value) : null,
    exang: form.exang.value,
    oldpeak: form.oldpeak.value ? Number(form.oldpeak.value) : null,
    slope: form.slope.value,
    ca: form.ca.value ? Number(form.ca.value) : null,
    thal: form.thal.value
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      throw new Error(`API error (${res.status})`);
    }

    const result = await res.json();
    setResult(result.risk_percent, result.risk_band);
    setStatus("Prediction successful.");
  } catch (err) {
    console.error(err);
    setStatus("Failed to get prediction. Is the backend running?", true);
  }
});

function bandStyle(band) {
  if (band === "High") return "rgba(255,107,107,0.25)";
  if (band === "Moderate") return "rgba(255,212,59,0.25)";
  return "rgba(105,219,124,0.25)";
}

function renderHistory(items) {
  if (!items || items.length === 0) {
    historyEl.innerHTML = `<p class="note">No predictions saved yet.</p>`;
    return;
  }

  historyEl.innerHTML = items.map((row) => {
    const when = row.created_at ? row.created_at.replace("T", " ").slice(0, 19) : "—";
    const meta = `#${row.id} • ${when} • Age ${row.age ?? "—"} • ${row.sex ?? "—"} • ${row.cp ?? "—"}`;
    return `
      <div class="history-item">
        <div class="history-meta">${meta}</div>
        <div class="history-risk">${row.risk_percent}%</div>
        <div class="history-band" style="background:${bandStyle(row.risk_band)}">${row.risk_band}</div>
      </div>
    `;
  }).join("");
}

btnLoadHistory.addEventListener("click", async () => {
  setStatus("Loading prediction history...");

  try {
    const res = await fetch(HISTORY_URL, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!res.ok) throw new Error(`History API error (${res.status})`);

    const items = await res.json();
    renderHistory(items);
    setStatus("History loaded.");
  } catch (err) {
    console.error(err);
    setStatus("Failed to load history. Is the backend running?", true);
  }
});
