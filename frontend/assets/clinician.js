
// The base URL for the FastAPI backend
const API_BASE = "http://127.0.0.1:8000";

// JWT Token saved at the login
const token = localStorage.getItem("cardiox_token");

// Status outputs for adding patient, editing patient and general.
const statusEl = document.getElementById("status");
const addPatientStatusEl = document.getElementById("addPatientStatus");
const editPatientStatusEl = document.getElementById("editPatientStatus");

// Selected patient card + search results
const patientDetailsEl = document.getElementById("patientDetails");
const searchResultsEl = document.getElementById("searchResults");

// Assessment histroy section for the selected patient
const assessmentHistorySection = document.getElementById("assessmentHistorySection");
const assessmentHistoryEl = document.getElementById("assessmentHistory");

// Top buttons
const btnLogout = document.getElementById("btnLogout");
const btnStartAssessment = document.getElementById("btnStartAssessment");

// Search form elements
const searchForm = document.getElementById("searchForm");
const searchQueryInput = document.getElementById("searchQuery");

// Form inputs to add a new patient
const addPatientForm = document.getElementById("addPatientForm");
const firstNameOfNewPatient = document.getElementById("firstNameOfNewPatient");
const lastNameOfNewPatient = document.getElementById("lastNameOfNewPatient");
const dateOfBirthOfNewPatient = document.getElementById("dateOfBirthOfNewPatient");
const sexOfNewPatient = document.getElementById("sexOfNewPatient");

// Editing patient section and inputs 
const editPatientSection = document.getElementById("editPatientSection");
const editPatientForm = document.getElementById("editPatientForm");
const editFirstName = document.getElementById("editFirstName");
const editLastName = document.getElementById("editLastName");
const editDob = document.getElementById("editDob");
const editSex = document.getElementById("editSex");

// Currently selected patient
let selectedPatient = null;

// Storing the last search term -> results can refresh after changes
let lastSearchQuery = "";

// Building headers for authenticated API calls
function authHeaders() {
  return { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
}

// If token invalid or session expired then user faces force logout
function forceLogout() {
  localStorage.clear();
  window.location.replace("login.html");
}

// General status message to clinician
function setStatus(msg, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#dc2626" : "#475569";
}

// Status message when adding a patient
function setAddPatientStatus(msg, isError = false) {
  if (!addPatientStatusEl) return;
  addPatientStatusEl.textContent = msg;
  addPatientStatusEl.style.color = isError ? "#dc2626" : "#475569";
}

// Status message for editing a patient
function setEditPatientStatus(msg, isError = false) {
  if (!editPatientStatusEl) return;
  editPatientStatusEl.textContent = msg;
  editPatientStatusEl.style.color = isError ? "#dc2626" : "#475569";
}

// Enabling or disabling "Start Assessment' button depending on patient selected
function enableAssessmentButton(patient) {
  if (!btnStartAssessment) return;
  btnStartAssessment.disabled = !patient;
}

// Rending selected patient summary card
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

// Showing the edit section and then filling in patient data if button pressed
function showEditPatient(patient) {
  editPatientSection.style.display = "block";
  editFirstName.value = patient.first_name || "";
  editLastName.value = patient.last_name || "";
  editDob.value = patient.dob || "";
  editSex.value = patient.sex || "";
}

// Reseting the UI
function clearSelectedPatientUI() {
  selectedPatient = null;
  renderPatient(null);
  editPatientSection.style.display = "none";
  enableAssessmentButton(null);

  hideAssessmentHistorySection();
if (assessmentHistoryEl) assessmentHistoryEl.innerHTML = `<p class="note">No assessments loaded.</p>`;

}

// Formatting ISO timestamp into a cleaner display
function formatDateTime(iso) {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 19);
}

// Shows the assessment history section
function showAssessmentHistorySection() {
  if (assessmentHistorySection) assessmentHistorySection.style.display = "block";
}

// Hides the assessment history section, if no previous assessments
function hideAssessmentHistorySection() {
  if (assessmentHistorySection) assessmentHistorySection.style.display = "none";
}

// Loading the clinician name for the "Welcome" header on top of the UI
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

// Fetching assessment history for the specified patient
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

// Changing assessment history + attaching edit and delete actions  
function renderAssessmentHistory(items) {
  if (!assessmentHistoryEl) return;

  // If no assessments available, then history is hidden
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

  // Opening assessment page in the edit mode
  document.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit");
      window.location.href =
        `assessment.html?patient_uid=${encodeURIComponent(selectedPatient.patient_uid)}&assessment_id=${encodeURIComponent(id)}`;
    });
  });

  // Deleting an assessment record from database
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

// Fetching the full patient record by unique IDs
async function fetchPatientByUid(patientUid) {
  const res = await fetch(`${API_BASE}/clinician/patients/${encodeURIComponent(patientUid)}`, { headers: authHeaders() });
  if (res.status === 401 || res.status === 403) return forceLogout();
  if (!res.ok) return null;
  return await res.json();
}

// Changing search results and allowing clinician to select a patient
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

  // When a patient clicked -> Load Patient -> Show Edit -> Show Assessment history
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

// Refreshing results after adding or editing by using the last used search query
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

// Searching for patient using ID or name
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

// Adding a new patient -> Create new patient record in database
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

  // Automatically selecting newly created patient
  setAddPatientStatus(`Created patient: ${data.patient_uid}`);
  selectedPatient = data;
  enableAssessmentButton(selectedPatient);
  renderPatient(data);
  showEditPatient(data);

  // Loading the assessment history (they're empty in the beginning)
  showAssessmentHistorySection();
  await loadAssessmentHistory(selectedPatient.patient_uid);

  // Clear create form inputs
  firstNameOfNewPatient.value = "";
  lastNameOfNewPatient.value = "";
  dateOfBirthOfNewPatient.value = "";
  sexOfNewPatient.value = "";

  await refreshSearchResults();
});

// Editing a patient -> Update patient details in DB
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

// Logout button
btnLogout?.addEventListener("click", forceLogout);

// Init -> resets page state and load clinician welcome
clearSelectedPatientUI();
loadingTheWelcome();
