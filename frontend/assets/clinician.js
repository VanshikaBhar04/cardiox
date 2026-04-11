// --------------------------------------------------
// CardioX Clinician Dashboard Script
// --------------------------------------------------

// Handles clinician-side patient management, patient selection,
// assessment history, and navigation to assessment workflows.


// --------------------------------------------------
// API configuration and authentication
// --------------------------------------------------

// Base URL for the FastAPI backend
const API_BASE = "http://127.0.0.1:8000";

// JWT token saved at login
const token = localStorage.getItem("cardiox_token");


// --------------------------------------------------
// Status and feedback elements
// --------------------------------------------------

const statusEl = document.getElementById("status");
const addPatientStatusEl = document.getElementById("addPatientStatus");
const editPatientStatusEl = document.getElementById("editPatientStatus");


// --------------------------------------------------
// Patient details and assessment history UI
// --------------------------------------------------

const patientDetailsEl = document.getElementById("patientDetails");
const assessmentHistorySection = document.getElementById("assessmentHistorySection");
const assessmentHistoryEl = document.getElementById("assessmentHistory");


// --------------------------------------------------
// Top action buttons
// --------------------------------------------------

const btnLogout = document.getElementById("btnLogout");
const btnStartAssessment = document.getElementById("btnStartAssessment");
const btnDeletePatient = document.getElementById("btnDeletePatient");


// --------------------------------------------------
// Search and patient table elements
// --------------------------------------------------

const searchForm = document.getElementById("searchForm");
const searchQueryInput = document.getElementById("searchQuery");
const patientTableBody = document.getElementById("patientTableBody");
const btnLoadAllPatients = document.getElementById("btnLoadAllPatients");
const noResultsBox = document.getElementById("noResultsBox");
const btnQuickAddPatient = document.getElementById("btnQuickAddPatient");


// --------------------------------------------------
// Add patient form elements
// --------------------------------------------------

const addPatientForm = document.getElementById("addPatientForm");
const firstNameOfNewPatient = document.getElementById("firstNameOfNewPatient");
const lastNameOfNewPatient = document.getElementById("lastNameOfNewPatient");
const dateOfBirthOfNewPatient = document.getElementById("dateOfBirthOfNewPatient");
const sexOfNewPatient = document.getElementById("sexOfNewPatient");


// --------------------------------------------------
// Edit patient form elements
// --------------------------------------------------

const editPatientSection = document.getElementById("editPatientSection");
const editPatientForm = document.getElementById("editPatientForm");
const editFirstName = document.getElementById("editFirstName");
const editLastName = document.getElementById("editLastName");
const editDob = document.getElementById("editDob");
const editSex = document.getElementById("editSex");


// --------------------------------------------------
// Client-side page state
// --------------------------------------------------

// Currently selected patient in the clinician dashboard
let selectedPatient = null;

// Stores the latest search term so the table can be refreshed consistently
let lastSearchQuery = "";

// Controls whether full assessment history is expanded
let isAssessmentHistoryExpanded = false;


// --------------------------------------------------
// Authentication helpers
// --------------------------------------------------

function authHeaders() {
  // Builds authenticated headers for protected API requests
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };
}

function forceLogout() {
  // Clears session data and redirects to the login page on auth failure
  localStorage.removeItem("cardiox_token");
  localStorage.removeItem("cardiox_role");
  localStorage.removeItem("cardiox_username");
  window.location.replace("login.html");
}


// --------------------------------------------------
// Status message helpers
// --------------------------------------------------

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


// --------------------------------------------------
// Validation and formatting helpers
// --------------------------------------------------

function containsLettersOnly(value) {
  return /^[A-Za-z]+$/.test(value.trim());
}

function toCapitalisedName(value) {
  const cleaned = value.trim().toLowerCase();
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function validateNameField(value, fieldLabel) {
  // Validates patient names before create or update requests
  if (!value.trim()) {
    return `${fieldLabel} is required.`;
  }

  if (!containsLettersOnly(value)) {
    return `${fieldLabel} must contain letters only. Please retry.`;
  }

  return "";
}

function formatBritishDate(isoDate) {
  // Converts ISO date values into a UK-friendly display format
  if (!isoDate) return "—";

  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatDateTime(iso) {
  // Formats stored timestamps for readable assessment history display
  if (!iso) return "—";

  const dt = iso.replace("T", " ").slice(0, 19);
  const [datePart, timePart] = dt.split(" ");
  if (!datePart) return iso;

  const [year, month, day] = datePart.split("-");
  return `${day}/${month}/${year}${timePart ? ` ${timePart}` : ""}`;
}

function formatRiskBandClass(band) {
  // Returns inline styling for visual risk band emphasis
  if (band === "High") return "background: rgba(220, 38, 38, 0.12); color: #b91c1c;";
  if (band === "Moderate") return "background: rgba(245, 158, 11, 0.14); color: #b45309;";
  return "background: rgba(22, 163, 74, 0.12); color: #15803d;";
}


// --------------------------------------------------
// Patient selection and UI state helpers
// --------------------------------------------------

function enableAssessmentButton(patient) {
  // Enables or disables patient-specific actions based on selection state
  if (btnStartAssessment) {
    btnStartAssessment.disabled = !patient;
  }

  if (btnDeletePatient) {
    btnDeletePatient.disabled = !patient;
  }
}

function highlightSelectedPatientRow(patientUid) {
  // Visually highlights the selected patient in the table
  document.querySelectorAll("#patientTableBody tr[data-uid]").forEach((row) => {
    row.classList.remove("patient-row-selected");

    if (row.dataset.uid === patientUid) {
      row.classList.add("patient-row-selected");
    }
  });
}

function renderPatient(patient) {
  // Renders the currently selected patient summary panel
  const selectedPatientBadge = document.getElementById("selectedPatientBadge");

  if (!patient) {
    if (patientDetailsEl) {
      patientDetailsEl.innerHTML = `<p class="note">No patient selected yet.</p>`;
    }

    if (selectedPatientBadge) {
      selectedPatientBadge.textContent = "None";
    }

    return;
  }

  if (patientDetailsEl) {
    patientDetailsEl.innerHTML = `
      <div class="history-item selected-patient-summary" style="grid-template-columns: 1fr;">
        <div class="history-meta">
          <strong>Patient ID:</strong> ${patient.patient_uid}<br/>
          <strong>Name:</strong> ${patient.first_name} ${patient.last_name}<br/>
          <strong>DOB:</strong> ${formatBritishDate(patient.dob)}<br/>
          <strong>Sex:</strong> ${patient.sex}
        </div>
      </div>
    `;
  }

  if (selectedPatientBadge) {
    selectedPatientBadge.textContent = `${patient.first_name} ${patient.last_name}`;
  }
}

function showEditPatient(patient) {
  // Displays the edit form pre-filled with the selected patient's details
  if (!editPatientSection) return;

  editPatientSection.style.display = "block";
  editFirstName.value = patient.first_name || "";
  editLastName.value = patient.last_name || "";
  editDob.value = patient.dob || "";
  editSex.value = patient.sex || "";
}

function clearSelectedPatientUI() {
  // Resets the selected patient area after deletion or initial page load
  selectedPatient = null;
  renderPatient(null);

  if (editPatientSection) {
    editPatientSection.style.display = "none";
  }

  enableAssessmentButton(null);
  hideAssessmentHistorySection();

  document.querySelectorAll("#patientTableBody tr[data-uid]").forEach((row) => {
    row.classList.remove("patient-row-selected");
  });

  if (assessmentHistoryEl) {
    assessmentHistoryEl.innerHTML = `<p class="note">No assessments loaded.</p>`;
  }

  setEditPatientStatus("");
}


// --------------------------------------------------
// Assessment history section visibility
// --------------------------------------------------

function showAssessmentHistorySection() {
  if (assessmentHistorySection) {
    assessmentHistorySection.style.display = "block";
  }
}

function hideAssessmentHistorySection() {
  if (assessmentHistorySection) {
    assessmentHistorySection.style.display = "none";
  }
}


// --------------------------------------------------
// Profile and welcome message
// --------------------------------------------------

async function loadingTheWelcome() {
  // Loads the clinician profile to personalise the dashboard heading
  try {
    const res = await fetch(`${API_BASE}/profile/me`, {
      headers: authHeaders()
    });

    if (!res.ok) return;

    const p = await res.json();
    const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.username;
    const el = document.getElementById("welcomeTitle");

    if (el) {
      el.textContent = `Welcome, ${name}`;
    }
  } catch (err) {
    console.error("Failed to load welcome profile:", err);
  }
}


// --------------------------------------------------
// Assessment history loading and rendering
// --------------------------------------------------

async function loadAssessmentHistory(patient_uid) {
  // Retrieves all stored assessments for the selected patient
  if (!assessmentHistoryEl) return;

  assessmentHistoryEl.innerHTML = `<p class="note">Loading assessments…</p>`;

  try {
    const res = await fetch(
      `${API_BASE}/clinician/patients/${encodeURIComponent(patient_uid)}/assessments?limit=50`,
      { headers: authHeaders() }
    );

    if (res.status === 401 || res.status === 403) {
      return forceLogout();
    }

    if (!res.ok) {
      assessmentHistoryEl.innerHTML = `<p class="note">Failed to load assessments.</p>`;
      return;
    }

    const items = await res.json();
    renderAssessmentHistory(items);
  } catch (err) {
    console.error("Failed to load assessments:", err);
    assessmentHistoryEl.innerHTML = `<p class="note">Network error while loading assessments.</p>`;
  }
}

function renderAssessmentHistory(items) {
  // Renders a condensed or expanded assessment history list
  if (!assessmentHistoryEl) return;

  showAssessmentHistorySection();

  if (!items || items.length === 0) {
    assessmentHistoryEl.innerHTML = `<p class="note">No previous assessments for this patient.</p>`;
    return;
  }

  const hasMultiple = items.length > 1;
  const assessmentsToShow = isAssessmentHistoryExpanded ? items : [items[0]];

  const historyCards = assessmentsToShow.map((a) => `
    <div class="history-item">
      <div class="assessment-history-main">
        <div class="history-meta">
          <strong>${formatDateTime(a.created_at)}</strong><br/>
          Assessment ID: ${a.id}
        </div>
      </div>

      <div class="assessment-history-right">
        <div class="history-risk">${a.risk_percent}%</div>
        <div class="history-band" style="${formatRiskBandClass(a.risk_band)}">${a.risk_band}</div>
      </div>

      <div class="assessment-history-actions">
        <button type="button" class="secondary" data-edit="${a.id}">Edit</button>
        <button type="button" class="secondary" data-del="${a.id}">Delete</button>
      </div>
    </div>
  `).join("");

  const toggleButton = hasMultiple
    ? `
      <div class="assessment-history-toggle">
        <button
          type="button"
          class="secondary"
          id="btnToggleAssessmentHistory"
        >
          ${isAssessmentHistoryExpanded ? "Show Recent Only" : `View Full History (${items.length})`}
        </button>
      </div>
    `
    : "";

  assessmentHistoryEl.innerHTML = `
    ${historyCards}
    ${toggleButton}
  `;

  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!selectedPatient) return;

      const id = btn.getAttribute("data-edit");
      window.location.href =
        `assessment.html?patient_uid=${encodeURIComponent(selectedPatient.patient_uid)}&assessment_id=${encodeURIComponent(id)}`;
    });
  });

  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!selectedPatient) return;

      const id = btn.getAttribute("data-del");
      const ok = window.confirm("Delete this assessment record?");
      if (!ok) return;

      try {
        const res = await fetch(
          `${API_BASE}/clinician/assessments/${encodeURIComponent(id)}`,
          {
            method: "DELETE",
            headers: authHeaders()
          }
        );

        const data = await res.json().catch(() => ({}));

        if (res.status === 401 || res.status === 403) {
          return forceLogout();
        }

        if (!res.ok) {
          return setStatus(data.detail || "Delete failed.", true);
        }

        await loadAssessmentHistory(selectedPatient.patient_uid);
        setStatus("Assessment deleted.");
      } catch (err) {
        console.error("Failed to delete assessment:", err);
        setStatus("Network error while deleting assessment.", true);
      }
    });
  });

  const toggleBtn = document.getElementById("btnToggleAssessmentHistory");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      isAssessmentHistoryExpanded = !isAssessmentHistoryExpanded;
      renderAssessmentHistory(items);
    });
  }
}


// --------------------------------------------------
// Patient loading and table rendering
// --------------------------------------------------

async function fetchPatientByUid(patientUid) {
  // Retrieves the full patient record when a table row is selected
  try {
    const res = await fetch(
      `${API_BASE}/clinician/patients/${encodeURIComponent(patientUid)}`,
      { headers: authHeaders() }
    );

    if (res.status === 401 || res.status === 403) {
      forceLogout();
      return null;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("Failed to fetch patient:", data);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error("Network error fetching patient:", err);
    return null;
  }
}

function renderPatientTable(items) {
  // Renders the patient search results table
  if (!patientTableBody) return;

  if (!items || items.length === 0) {
    patientTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-cell">No matching patients found.</td>
      </tr>
    `;

    if (noResultsBox) {
      noResultsBox.style.display = "block";
    }

    return;
  }

  if (noResultsBox) {
    noResultsBox.style.display = "none";
  }

  patientTableBody.innerHTML = items.map((p) => `
    <tr data-uid="${p.patient_uid}" class="patient-select-row">
      <td>${p.patient_uid}</td>
      <td>${p.first_name}</td>
      <td>${p.last_name}</td>
      <td>${formatBritishDate(p.dob)}</td>
      <td>${p.sex}</td>
    </tr>
  `).join("");

  if (selectedPatient?.patient_uid) {
    highlightSelectedPatientRow(selectedPatient.patient_uid);
  }
}

// Keeps compatibility if called elsewhere
function renderSearchResults(items) {
  renderPatientTable(items);
}

async function refreshSearchResults() {
  // Reloads the visible patient table using the most recent search criteria
  const query = (lastSearchQuery || "").trim();

  let url = "";
  if (!query) {
    url = `${API_BASE}/clinician/patients/search?limit=100`;
  } else {
    const isPatientId = query.startsWith("P-");
    url = isPatientId
      ? `${API_BASE}/clinician/patients/search?patient_uid=${encodeURIComponent(query)}&limit=100`
      : `${API_BASE}/clinician/patients/search?name=${encodeURIComponent(query)}&limit=100`;
  }

  try {
    const res = await fetch(url, { headers: authHeaders() });

    if (res.status === 401 || res.status === 403) {
      return forceLogout();
    }

    if (!res.ok) return;

    const items = await res.json();
    renderPatientTable(items);
  } catch (err) {
    console.error("Failed to refresh search results:", err);
  }
}

async function loadAllPatients() {
  // Loads the full patient list for the clinician dashboard
  setStatus("Loading patients...");

  try {
    const res = await fetch(`${API_BASE}/clinician/patients/search?limit=100`, {
      headers: authHeaders()
    });

    if (res.status === 401 || res.status === 403) {
      return forceLogout();
    }

    if (!res.ok) {
      return setStatus("Failed to load patients.", true);
    }

    const items = await res.json();
    renderPatientTable(items);
    setStatus("Patients loaded.");
  } catch (err) {
    console.error("Failed to load patients:", err);
    setStatus("Network error while loading patients.", true);
  }
}


// --------------------------------------------------
// Search interactions
// --------------------------------------------------

searchForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const query = searchQueryInput.value.trim();
  lastSearchQuery = query;

  if (!query) {
    await loadAllPatients();
    return;
  }

  setStatus("Searching...");

  const isPatientId = query.startsWith("P-");
  const url = isPatientId
    ? `${API_BASE}/clinician/patients/search?patient_uid=${encodeURIComponent(query)}&limit=100`
    : `${API_BASE}/clinician/patients/search?name=${encodeURIComponent(query)}&limit=100`;

  try {
    const res = await fetch(url, { headers: authHeaders() });

    if (res.status === 401 || res.status === 403) {
      return forceLogout();
    }

    if (!res.ok) {
      return setStatus("Search failed.", true);
    }

    const items = await res.json();
    renderPatientTable(items);
    setStatus(`${items.length} result(s).`);
  } catch (err) {
    console.error("Search failed:", err);
    setStatus("Network error while searching.", true);
  }
});


// --------------------------------------------------
// Patient table selection
// --------------------------------------------------

patientTableBody?.addEventListener("click", async (e) => {
  const row = e.target.closest("tr[data-uid]");
  if (!row) return;

  const uid = row.dataset.uid;
  if (!uid) return;

  setStatus("Loading patient...");

  try {
    const patient = await fetchPatientByUid(uid);

    if (!patient) {
      setStatus("Failed to load selected patient.", true);
      return;
    }

    selectedPatient = patient;
    enableAssessmentButton(selectedPatient);
    renderPatient(patient);
    showEditPatient(patient);
    highlightSelectedPatientRow(patient.patient_uid);
    setStatus("Patient selected.");

    isAssessmentHistoryExpanded = false;

    showAssessmentHistorySection();
    if (assessmentHistoryEl) {
      assessmentHistoryEl.innerHTML = `<p class="note">Loading assessments…</p>`;
    }

    await loadAssessmentHistory(selectedPatient.patient_uid);
  } catch (err) {
    console.error("Error selecting patient:", err);
    setStatus("Error selecting patient.", true);
  }
});


// --------------------------------------------------
// Input formatting interactions
// --------------------------------------------------

// Auto-format add patient names on blur
[firstNameOfNewPatient, lastNameOfNewPatient].forEach((input) => {
  input?.addEventListener("blur", () => {
    input.value = toCapitalisedName(input.value);
  });
});

// Auto-format edit patient names on blur
[editFirstName, editLastName].forEach((input) => {
  input?.addEventListener("blur", () => {
    input.value = toCapitalisedName(input.value);
  });
});


// --------------------------------------------------
// Create patient workflow
// --------------------------------------------------

addPatientForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const firstNameError = validateNameField(firstNameOfNewPatient.value, "First name");
  if (firstNameError) {
    setAddPatientStatus(firstNameError, true);
    firstNameOfNewPatient.focus();
    return;
  }

  const lastNameError = validateNameField(lastNameOfNewPatient.value, "Last name");
  if (lastNameError) {
    setAddPatientStatus(lastNameError, true);
    lastNameOfNewPatient.focus();
    return;
  }

  firstNameOfNewPatient.value = toCapitalisedName(firstNameOfNewPatient.value);
  lastNameOfNewPatient.value = toCapitalisedName(lastNameOfNewPatient.value);

  setAddPatientStatus("Creating patient...");

  const payload = {
    first_name: firstNameOfNewPatient.value,
    last_name: lastNameOfNewPatient.value,
    dob: dateOfBirthOfNewPatient.value,
    sex: sexOfNewPatient.value
  };

  try {
    const res = await fetch(`${API_BASE}/clinician/patients`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 401 || res.status === 403) {
      return forceLogout();
    }

    if (!res.ok) {
      return setAddPatientStatus(data.detail || "Failed to create patient.", true);
    }

    setAddPatientStatus(`Created patient: ${data.patient_uid}`);

    selectedPatient = data;
    enableAssessmentButton(selectedPatient);
    renderPatient(data);
    showEditPatient(data);

    firstNameOfNewPatient.value = "";
    lastNameOfNewPatient.value = "";
    dateOfBirthOfNewPatient.value = "";
    sexOfNewPatient.value = "";

    await loadAllPatients();
    highlightSelectedPatientRow(data.patient_uid);

    isAssessmentHistoryExpanded = false;

    showAssessmentHistorySection();
    await loadAssessmentHistory(selectedPatient.patient_uid);
  } catch (err) {
    console.error("Failed to create patient:", err);
    setAddPatientStatus("Network error while creating patient.", true);
  }
});


// --------------------------------------------------
// Update patient workflow
// --------------------------------------------------

editPatientForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!selectedPatient) {
    return setEditPatientStatus("Select a patient first.", true);
  }

  const firstNameError = validateNameField(editFirstName.value, "First name");
  if (firstNameError) {
    setEditPatientStatus(firstNameError, true);
    editFirstName.focus();
    return;
  }

  const lastNameError = validateNameField(editLastName.value, "Last name");
  if (lastNameError) {
    setEditPatientStatus(lastNameError, true);
    editLastName.focus();
    return;
  }

  editFirstName.value = toCapitalisedName(editFirstName.value);
  editLastName.value = toCapitalisedName(editLastName.value);

  setEditPatientStatus("Saving...");

  const payload = {
    first_name: editFirstName.value,
    last_name: editLastName.value,
    dob: editDob.value,
    sex: editSex.value
  };

  try {
    const res = await fetch(
      `${API_BASE}/clinician/patients/${encodeURIComponent(selectedPatient.patient_uid)}`,
      {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      }
    );

    const data = await res.json().catch(() => ({}));

    if (res.status === 401 || res.status === 403) {
      return forceLogout();
    }

    if (!res.ok) {
      return setEditPatientStatus(data.detail || "Update failed.", true);
    }

    selectedPatient = data;
    enableAssessmentButton(selectedPatient);
    renderPatient(data);
    showEditPatient(data);

    await refreshSearchResults();
    highlightSelectedPatientRow(data.patient_uid);
    setEditPatientStatus("Patient updated.");
  } catch (err) {
    console.error("Failed to update patient:", err);
    setEditPatientStatus("Network error while updating patient.", true);
  }
});


// --------------------------------------------------
// Assessment navigation
// --------------------------------------------------

btnStartAssessment?.addEventListener("click", () => {
  // Navigates to the assessment workflow for the selected patient
  if (!selectedPatient) return;

  window.location.href = `assessment.html?patient_uid=${encodeURIComponent(selectedPatient.patient_uid)}`;
});


// --------------------------------------------------
// Delete patient workflow
// --------------------------------------------------

btnDeletePatient?.addEventListener("click", async () => {
  if (!selectedPatient) {
    return setStatus("Select a patient first.", true);
  }

  const patientName = `${selectedPatient.first_name} ${selectedPatient.last_name}`.trim();
  const confirmed = window.confirm(
    `Delete patient "${patientName}" (${selectedPatient.patient_uid})?\n\nThis will also permanently delete all linked assessments.`
  );

  if (!confirmed) return;

  setStatus("Deleting patient...");

  try {
    const res = await fetch(
      `${API_BASE}/clinician/patients/${encodeURIComponent(selectedPatient.patient_uid)}`,
      {
        method: "DELETE",
        headers: authHeaders()
      }
    );

    const data = await res.json().catch(() => ({}));

    if (res.status === 401 || res.status === 403) {
      return forceLogout();
    }

    if (!res.ok) {
      return setStatus(data.detail || "Failed to delete patient.", true);
    }

    const deletedPatientUid = selectedPatient.patient_uid;
    const deletedPatientName = `${selectedPatient.first_name} ${selectedPatient.last_name}`.trim();
    const deletedAssessments = data.deleted_assessments ?? 0;

    clearSelectedPatientUI();
    await refreshSearchResults();

    setStatus(
      `Deleted patient ${deletedPatientName} (${deletedPatientUid}) and ${deletedAssessments} linked assessment(s).`
    );
  } catch (err) {
    console.error("Failed to delete patient:", err);
    setStatus("Network error while deleting patient.", true);
  }
});


// --------------------------------------------------
// General button actions
// --------------------------------------------------

btnLoadAllPatients?.addEventListener("click", loadAllPatients);

btnQuickAddPatient?.addEventListener("click", () => {
  // Scrolls to the add patient form for faster workflow access
  window.scrollTo({ top: 0, behavior: "smooth" });
  firstNameOfNewPatient?.focus();
});

btnLogout?.addEventListener("click", forceLogout);


// --------------------------------------------------
// Initial page load
// --------------------------------------------------

clearSelectedPatientUI();
loadingTheWelcome();
loadAllPatients();