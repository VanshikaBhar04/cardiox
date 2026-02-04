// Base backend URL 
const API_BASE = "http://127.0.0.1:8000";

// Admin JWT token
const token = localStorage.getItem("cardiox_token");

// UI Elements
const statusEl = document.getElementById("status");
const clinicianListEl = document.getElementById("clinicianList");
const btnRefresh = document.getElementById("btnRefresh");
const btnLogout = document.getElementById("btnLogout");

// Creating + Editing the clinician form
const form = document.getElementById("createClinicianForm");
const editingClinicianId = document.getElementById("editingClinicianId");
const usernameOfClinician = document.getElementById("usernameOfClinician");
const passwordOfClinician = document.getElementById("passwordOfClinician");
const firstNameOfClinician = document.getElementById("clinicianFirstName");
const lastNameOfClinician = document.getElementById("clinicianLastName");

const btnCancelEdit = document.getElementById("btnCancelEdit");

// Authenticating headers for admin API calls
function authHeaders() {
  return { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
}
// Show status message on admin dashboard
function setStatus(msg, isError = false) {
  if (typeof msg === "object") msg = JSON.stringify(msg, null, 2);
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#dc2626" : "#475569";
}
// Clears localStorage and returns to login page
function forceLogout() {
  localStorage.clear();
  window.location.replace("login.html");
}
// Reset form back to "Create clinician format"
function resetForm() {
  editingClinicianId.value = "";
  usernameOfClinician.value = "";
  passwordOfClinician.value = "";
  firstNameOfClinician.value = "";
  lastNameOfClinician.value = "";
  usernameOfClinician.disabled = false;
  passwordOfClinician.placeholder = "Only needed for NEW clinician";
  setStatus("");
}
// Render clinicians list with Edit / Delete buttons
function renderClinicians(items) {
  if (!items || items.length === 0) {
    clinicianListEl.innerHTML = `<p class="note">No clinicians found.</p>`;
    return;
  }

  clinicianListEl.innerHTML = items.map(c => {
    const when = c.created_at ? c.created_at.replace("T", " ").slice(0, 19) : "—";
    const full = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.username;
    const cid = c.clinician_uid ?? "—";
    return `
      <div class="history-item" style="grid-template-columns: 1fr auto auto;">
        <div class="history-meta">
          <strong>${full}</strong><br/>
          Clinician ID: ${cid} • Username: ${c.username} • ${when}
        </div>
        <button class="secondary" data-edit="${c.id}">Edit</button>
        <button class="secondary" data-del="${c.id}">Delete</button>
      </div>
    `;
  }).join("");

// Editing clinician -> Only the name can be edited
  document.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit");
      const c = items.find(x => String(x.id) === String(id));
      if (!c) return;

      editingClinicianId.value = c.id;
      usernameOfClinician.value = c.username;
      usernameOfClinician.disabled = true; 
      firstNameOfClinician.value = c.first_name || "";
      lastNameOfClinician.value = c.last_name || "";
      passwordOfClinician.value = "";
      passwordOfClinician.placeholder = "Password unchanged (not editable here)";

      setStatus(`Editing clinician #${c.id} (${c.clinician_uid})`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
// Deleting a clinician's account
  document.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      const ok = confirm("Delete this clinician?");
      if (!ok) return;

      const res = await fetch(`${API_BASE}/admin/clinicians/${id}`, {
        method: "DELETE",
        headers: authHeaders()
      });

      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) return forceLogout();
      if (!res.ok) return setStatus(data.detail || "Delete failed.", true);

      setStatus("Clinician deleted.");
      await loadClinicians();
      resetForm();
    });
  });
}

//Fetching all the clinicians from the backend
async function loadClinicians() {
  setStatus("Loading clinicians...");
  const res = await fetch(`${API_BASE}/admin/clinicians`, { headers: authHeaders() });
  if (res.status === 401 || res.status === 403) return forceLogout();
  const items = await res.json();
  renderClinicians(items);
  setStatus("Clinicians loaded.");
}

// Form will be submitted _> A new clinician created or an existing clinician name is updated
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const isEdit = !!editingClinicianId.value;
  const first_name = firstNameOfClinician.value.trim();
  const last_name = lastNameOfClinician.value.trim();

  if (!first_name || !last_name) {
    setStatus("First name and Last name are required.", true);
    return;
  }

  if (!isEdit) {
    // CREATE clinician
    const username = usernameOfClinician.value.trim();
    const password = passwordOfClinician.value;

    if (!username || !password) {
      setStatus("The Username and password are required for a new clinician.", true);
      return;
    }

    setStatus("Creating the clinician...");
    const res = await fetch(`${API_BASE}/admin/clinicians`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ username, password, first_name, last_name })
    });

    const data = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) return forceLogout();
    if (!res.ok) return setStatus(data.detail || "Create failed.", true);

    setStatus(`Clinician has been created: ${data.first_name} ${data.last_name} (${data.clinician_uid})`);
    await loadClinicians();
    resetForm();
    return;
  }

  // UPDATE clinician (name only)
  const id = editingClinicianId.value;
  setStatus("Updating the clinician...");

  const res = await fetch(`${API_BASE}/admin/clinicians/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ first_name, last_name })
  });

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) return forceLogout();
  if (!res.ok) return setStatus(data.detail || "Update has failed.", true);

  setStatus("Clinician has been updated.");
  await loadClinicians();
  resetForm();
});

btnCancelEdit?.addEventListener("click", resetForm);
btnRefresh?.addEventListener("click", loadClinicians);
btnLogout?.addEventListener("click", forceLogout);

loadClinicians();
