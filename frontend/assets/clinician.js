
const API_BASE = "http://127.0.0.1:8000";
const token = localStorage.getItem("cardiox_token");

const statusEl = document.getElementById("status");
const addPatientStatusEl = document.getElementById("addPatientStatus");
const editPatientStatusEl = document.getElementById("editPatientStatus");

const patientDetailsEl = document.getElementById("patientDetails");
const searchResultsEl = document.getElementById("searchResults");

const assessmentHistorySection = document.getElementById("assessmentHistorySection");
const assessmentHistoryEl = document.getElementById("assessmentHistory");


const btnLogout = document.getElementById("btnLogout");
const btnStartAssessment = document.getElementById("btnStartAssessment");

const searchForm = document.getElementById("searchForm");
const searchQueryInput = document.getElementById("searchQuery");

const addPatientForm = document.getElementById("addPatientForm");
const firstNameOfNewPatient = document.getElementById("firstNameOfNewPatient");
const lastNameOfNewPatient = document.getElementById("lastNameOfNewPatient");
const dateOfBirthOfNewPatient = document.getElementById("dateOfBirthOfNewPatient");
const sexOfNewPatient = document.getElementById("sexOfNewPatient");

const editPatientSection = document.getElementById("editPatientSection");
const editPatientForm = document.getElementById("editPatientForm");
const editFirstName = document.getElementById("editFirstName");
const editLastName = document.getElementById("editLastName");
const editDob = document.getElementById("editDob");
const editSex = document.getElementById("editSex");

let selectedPatient = null;
let lastSearchQuery = "";

function authHeaders() {
  return { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
}

function forceLogout() {
  localStorage.clear();
  window.location.replace("login.html");
}

function setStatus(msg, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#dc2626" : "#475569";
}

function setAddPatientStatus(msg, isError = false) {
  if (!addPatientStatusEl) return;
  addPatientStatusEl.textContent = msg;
  addPatientStatusEl.style.color = isError ? "#dc2626" : "#475569";
}

function setEditPatientStatus(msg, isError = false) {
  if (!editPatientStatusEl) return;
  editPatientStatusEl.textContent = msg;
  editPatientStatusEl.style.color = isError ? "#dc2626" : "#475569";
}

function enableAssessmentButton(patient) {
  if (!btnStartAssessment) return;
  btnStartAssessment.disabled = !patient;
}

function renderPatient(patient) {
  if (!patient) {
    patientDetailsEl.innerHTML = `<p class="note">No patient selected yet.</p>`;
    return;
  }
  patientDetailsEl.innerHTML = `
    <div class="history-item" style="grid-template-columns:1fr;">
      <div class="history-meta">
        <strong>Patient ID:</strong> ${patient.patient_uid}<br/>
        <strong>Name:</strong> ${patient.first_name} ${patient.last_name}<br/>
        <strong>DOB:</strong> ${patient.dob}<br/>
        <strong>Sex:</strong> ${patient.sex}
      </div>
    </div>`;
}

function showEditPatient(patient) {
  editPatientSection.style.display = "block";
  editFirstName.value = patient.first_name || "";
  editLastName.value = patient.last_name || "";
  editDob.value = patient.dob || "";
  editSex.value = patient.sex || "";
}

function clearSelectedPatientUI() {
  selectedPatient = null;
  renderPatient(null);
  editPatientSection.style.display = "none";
  enableAssessmentButton(null);

  hideAssessmentHistorySection();
if (assessmentHistoryEl) assessmentHistoryEl.innerHTML = `<p class="note">No assessments loaded.</p>`;

}

function formatDateTime(iso) {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 19);
}

function showAssessmentHistorySection() {
  if (assessmentHistorySection) assessmentHistorySection.style.display = "block";
}

function hideAssessmentHistorySection() {
  if (assessmentHistorySection) assessmentHistorySection.style.display = "none";
}


async function loadingTheWelcome() {
  try {
    const res = await fetch(`${API_BASE}/profile/me`, { headers: authHeaders() });
    if (!res.ok) return;
    const p = await res.json();
    const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.username;
    const el = document.getElementById("welcomeTitle");
    if (el) el.textContent = `Welcome, ${name}`;
  } catch {}
}

async function loadAssessmentHistory(patient_uid) {
  if (!assessmentHistoryEl) return;
  assessmentHistoryEl.innerHTML = `<p class="note">Loading assessments…</p>`;

  const res = await fetch(
    `${API_BASE}/clinician/patients/${encodeURIComponent(patient_uid)}/assessments?limit=50`,
    { headers: authHeaders() }
  );

  if (res.status === 401 || res.status === 403) return forceLogout();
  if (!res.ok) {
    assessmentHistoryEl.innerHTML = `<p class="note">Failed to load assessments.</p>`;
    return;
  }

  const items = await res.json();
  renderAssessmentHistory(items);
}

function renderAssessmentHistory(items) {
  if (!assessmentHistoryEl) return;

  if (!items || items.length === 0) {
    hideAssessmentHistorySection();
    assessmentHistoryEl.innerHTML = "";
    return;
  }

  showAssessmentHistorySection();

  assessmentHistoryEl.innerHTML = items.map(a => `
    <div class="history-item" style="grid-template-columns: 1fr auto auto auto;">
      <div class="history-meta">
        <strong>${formatDateTime(a.created_at)}</strong><br/>
        Assessment ID: ${a.id}
      </div>
      <div class="history-risk">${a.risk_percent}%</div>
      <div class="history-band">${a.risk_band}</div>
      <div class="actions" style="margin:0;">
        <button class="secondary" data-edit="${a.id}">Edit</button>
        <button class="secondary" data-del="${a.id}">Delete</button>
      </div>
    </div>
  `).join("");

  // Edit -> open assessment page with assessment_id
  document.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit");
      window.location.href =
        `assessment.html?patient_uid=${encodeURIComponent(selectedPatient.patient_uid)}&assessment_id=${encodeURIComponent(id)}`;
    });
  });

  // Delete -> delete assessment then refresh list
  document.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      const ok = confirm("Delete this assessment record?");
      if (!ok) return;

      const res = await fetch(`${API_BASE}/clinician/assessments/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: authHeaders()
      });

      if (res.status === 401 || res.status === 403) return forceLogout();
      if (!res.ok) return setStatus("Delete failed.", true);

      await loadAssessmentHistory(selectedPatient.patient_uid);
      setStatus("Assessment deleted.");
    });
  });
}

async function fetchPatientByUid(patientUid) {
  const res = await fetch(`${API_BASE}/clinician/patients/${encodeURIComponent(patientUid)}`, { headers: authHeaders() });
  if (res.status === 401 || res.status === 403) return forceLogout();
  if (!res.ok) return null;
  return await res.json();
}

function renderSearchResults(items) {
  if (!items || items.length === 0) {
    searchResultsEl.innerHTML = `<p class="note">No matching patients found.</p>`;
    return;
  }

  searchResultsEl.innerHTML = items.map(p => `
    <div class="history-item clickable" data-uid="${p.patient_uid}" style="grid-template-columns:1fr;">
      <div class="history-meta">
        <strong>${p.first_name} ${p.last_name}</strong><br/>
        Patient ID: ${p.patient_uid} • DOB: ${p.dob}
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".history-item.clickable").forEach(el => {
    el.addEventListener("click", async () => {
      const uid = el.dataset.uid;
      const patient = await fetchPatientByUid(uid);
      if (!patient) return;
      selectedPatient = patient;
      enableAssessmentButton(selectedPatient);
      renderPatient(patient);
      showEditPatient(patient);
      setStatus("Patient selected.");

      showAssessmentHistorySection();
      assessmentHistoryEl.innerHTML = `<p class="note">Loading assessments…</p>`;
await loadAssessmentHistory(selectedPatient.patient_uid);

    });
  });
}

async function refreshSearchResults() {
  const query = (lastSearchQuery || "").trim();
  if (!query) return;
  const isPatientId = query.startsWith("P-");
  const url = isPatientId
    ? `${API_BASE}/clinician/patients/search?patient_uid=${encodeURIComponent(query)}`
    : `${API_BASE}/clinician/patients/search?name=${encodeURIComponent(query)}`;

  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) return;
  const items = await res.json();
  renderSearchResults(items);
}

// Searching for patient
searchForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = searchQueryInput.value.trim();
  lastSearchQuery = query;
  if (!query) return;

  setStatus("Searching...");
  const isPatientId = query.startsWith("P-");
  const url = isPatientId
    ? `${API_BASE}/clinician/patients/search?patient_uid=${encodeURIComponent(query)}`
    : `${API_BASE}/clinician/patients/search?name=${encodeURIComponent(query)}`;

  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 401 || res.status === 403) return forceLogout();
  if (!res.ok) return setStatus("Search failed.", true);

  const items = await res.json();
  renderSearchResults(items);
  setStatus(`${items.length} result(s).`);
});

// Adding a new patient
addPatientForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setAddPatientStatus("Creating patient...");

  const payload = {
    first_name: firstNameOfNewPatient.value.trim(),
    last_name: lastNameOfNewPatient.value.trim(),
    dob: dateOfBirthOfNewPatient.value,
    sex: sexOfNewPatient.value
  };

  const res = await fetch(`${API_BASE}/clinician/patients`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) return forceLogout();
  if (!res.ok) return setAddPatientStatus(data.detail || "Failed to create patient.", true);

  setAddPatientStatus(`Created patient: ${data.patient_uid}`);
  selectedPatient = data;
  enableAssessmentButton(selectedPatient);
  renderPatient(data);
  showEditPatient(data);

  showAssessmentHistorySection();
  await loadAssessmentHistory(selectedPatient.patient_uid);

  firstNameOfNewPatient.value = "";
  lastNameOfNewPatient.value = "";
  dateOfBirthOfNewPatient.value = "";
  sexOfNewPatient.value = "";

  await refreshSearchResults();
});

// Editing a patient
editPatientForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selectedPatient) return setEditPatientStatus("Select a patient first.", true);

  setEditPatientStatus("Saving...");
  const payload = {
    first_name: editFirstName.value.trim(),
    last_name: editLastName.value.trim(),
    dob: editDob.value,
    sex: editSex.value
  };

  const res = await fetch(`${API_BASE}/clinician/patients/${encodeURIComponent(selectedPatient.patient_uid)}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) return forceLogout();
  if (!res.ok) return setEditPatientStatus(data.detail || "Update failed.", true);

  selectedPatient = data;
  enableAssessmentButton(selectedPatient);
  renderPatient(data);
  showEditPatient(data);

  await refreshSearchResults();
  setEditPatientStatus("Patient updated.");
});

// Start the clinical assessment
btnStartAssessment?.addEventListener("click", () => {
  if (!selectedPatient) return;
  window.location.href = `assessment.html?patient_uid=${encodeURIComponent(selectedPatient.patient_uid)}`;
});

// Logout
btnLogout?.addEventListener("click", forceLogout);

// Init
clearSelectedPatientUI();
loadingTheWelcome();
