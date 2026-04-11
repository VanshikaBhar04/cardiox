const API_BASE = "http://127.0.0.1:8000";
const token = localStorage.getItem("cardiox_token");

const userTableBody = document.getElementById("userTableBody");
const pendingTableBody = document.getElementById("pendingTableBody");
const auditTableBody = document.getElementById("auditTableBody");
const adminStatus = document.getElementById("adminStatus");

const btnRefreshUsers = document.getElementById("btnRefreshUsers");
const btnRefreshPending = document.getElementById("btnRefreshPending");
const btnRefreshAudit = document.getElementById("btnRefreshAudit");

const editUserSection = document.getElementById("editUserSection");
const editUserForm = document.getElementById("editUserForm");
const editingUserId = document.getElementById("editingUserId");
const editUserFirstName = document.getElementById("editUserFirstName");
const editUserLastName = document.getElementById("editUserLastName");
const editUserRole = document.getElementById("editUserRole");
const editUserDepartment = document.getElementById("editUserDepartment");
const btnCancelUserEdit = document.getElementById("btnCancelUserEdit");

const createUserForm = document.getElementById("createUserForm");
const createUserStatus = document.getElementById("createUserStatus");
const createUsername = document.getElementById("createUsername");
const createPassword = document.getElementById("createPassword");
const createFirstName = document.getElementById("createFirstName");
const createLastName = document.getElementById("createLastName");
const createEmail = document.getElementById("createEmail");
const createDepartment = document.getElementById("createDepartment");
const createRole = document.getElementById("createRole");

let cachedUsers = [];

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };
}

function forceLogout() {
  localStorage.removeItem("cardiox_token");
  localStorage.removeItem("cardiox_role");
  localStorage.removeItem("cardiox_username");
  window.location.replace("login.html");
}

function setStatus(msg, isError = false) {
  if (!adminStatus) return;
  adminStatus.textContent = msg;
  adminStatus.style.color = isError ? "#dc2626" : "#475569";
}

function formatRole(role) {
  const map = {
    admin: "Admin",
    manager: "Manager",
    employee: "Employee",
    it_technician: "IT Technician",
    clinician: "Clinician"
  };
  return map[role] || role || "—";
}

function formatStatus(status) {
  if (!status) return "—";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatAuditAction(action) {
  const map = {
    approve_user: "Approved User",
    deny_user: "Denied User",
    update_user: "Updated User",
    delete_user: "Deleted User",
    create_clinician: "Created Clinician",
    create_user: "Created User"
  };
  return map[action] || action || "—";
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const dt = iso.replace("T", " ").slice(0, 19);
  const [datePart, timePart] = dt.split(" ");
  if (!datePart) return iso;
  const [year, month, day] = datePart.split("-");
  return `${day}/${month}/${year}${timePart ? ` ${timePart}` : ""}`;
}

function renderStatusPill(status) {
  const value = (status || "").toLowerCase();

  let cls = "status-pill-default";
  if (value === "approved") cls = "status-pill-approved";
  else if (value === "pending") cls = "status-pill-pending";
  else if (value === "rejected" || value === "denied") cls = "status-pill-rejected";

  return `<span class="status-pill ${cls}">${formatStatus(status)}</span>`;
}

function showEditUser(user) {
  if (!editUserSection) return;

  editUserSection.style.display = "block";
  editingUserId.value = user.id;
  editUserFirstName.value = user.first_name || "";
  editUserLastName.value = user.last_name || "";
  editUserRole.value = user.role || "employee";
  editUserDepartment.value = user.department || "";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function hideEditUser() {
  if (!editUserSection) return;

  editUserSection.style.display = "none";
  editingUserId.value = "";
  editUserFirstName.value = "";
  editUserLastName.value = "";
  editUserRole.value = "employee";
  editUserDepartment.value = "";
  setStatus("");
}

function renderUsers(items) {
  if (!userTableBody) return;

  cachedUsers = items || [];

  if (!items || items.length === 0) {
    userTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">No users found.</td>
      </tr>
    `;
    return;
  }

  userTableBody.innerHTML = items.map(user => `
    <tr>
      <td>
        <span class="admin-cell-strong">${user.username || "—"}</span>
      </td>
      <td>
        <span class="admin-cell-strong">${(user.first_name || "")} ${(user.last_name || "")}</span>
        <span class="admin-cell-subtext">${user.email || "No email provided"}</span>
      </td>
      <td>${formatRole(user.role)}</td>
      <td>${user.department || "—"}</td>
      <td>${renderStatusPill(user.approval_status)}</td>
      <td>
        <div class="admin-actions">
          <button type="button" class="action-btn action-btn-edit" data-edit-user="${user.id}">Edit</button>
          <button type="button" class="action-btn action-btn-delete" data-delete-user="${user.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderPendingUsers(items) {
  if (!pendingTableBody) return;

  if (!items || items.length === 0) {
    pendingTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">No pending requests found.</td>
      </tr>
    `;
    return;
  }

  pendingTableBody.innerHTML = items.map(user => `
    <tr>
      <td>
        <span class="admin-cell-strong">${user.username || "—"}</span>
      </td>
      <td>
        <span class="admin-cell-strong">${(user.first_name || "")} ${(user.last_name || "")}</span>
      </td>
      <td>${user.email || "—"}</td>
      <td>${user.department || "—"}</td>
      <td>${renderStatusPill(user.approval_status)}</td>
      <td>
        <select class="pending-role-select" data-approve-role="${user.id}">
          <option value="clinician">Clinician</option>
          <option value="manager">Manager</option>
          <option value="employee">Employee</option>
          <option value="it_technician">IT Technician</option>
          <option value="admin">Admin</option>
        </select>
        <button type="button" class="action-btn action-btn-approve" data-approve-user="${user.id}">Approve</button>
      </td>
      <td>
        <textarea class="pending-deny-textarea" data-deny-reason="${user.id}" rows="2" placeholder="Reason for denial"></textarea>
        <button type="button" class="action-btn action-btn-deny" data-deny-user="${user.id}">Deny</button>
      </td>
    </tr>
  `).join("");
}

function renderAuditLogs(items) {
  if (!auditTableBody) return;

  if (!items || items.length === 0) {
    auditTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-cell">No audit logs found.</td>
      </tr>
    `;
    return;
  }

  auditTableBody.innerHTML = items.map(log => `
    <tr>
      <td>${formatDateTime(log.created_at)}</td>
      <td>
        <span class="admin-cell-strong">${log.actor_username || "—"}</span>
      </td>
      <td>${formatAuditAction(log.action)}</td>
      <td>${log.target_username || "—"}</td>
      <td class="audit-details-cell">${log.details || "—"}</td>
    </tr>
  `).join("");
}

function setCreateUserStatus(msg, isError = false) {
  if (!createUserStatus) return;
  createUserStatus.textContent = msg;
  createUserStatus.style.color = isError ? "#dc2626" : "#475569";
}

async function loadUsers() {
  if (userTableBody) {
    userTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">Loading users...</td>
      </tr>
    `;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: authHeaders()
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 401 || res.status === 403) return forceLogout();
    if (!res.ok) {
      userTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-cell">Failed to load users.</td>
        </tr>
      `;
      return setStatus(data.detail || "Failed to load users.", true);
    }

    renderUsers(data);
  } catch (err) {
    userTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">Network error while loading users.</td>
      </tr>
    `;
    setStatus("Network error while loading users.", true);
  }
}

async function loadPendingUsers() {
  if (pendingTableBody) {
    pendingTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">Loading pending requests...</td>
      </tr>
    `;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/pending-users`, {
      headers: authHeaders()
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 401 || res.status === 403) return forceLogout();
    if (!res.ok) {
      pendingTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-cell">Failed to load pending requests.</td>
        </tr>
      `;
      return setStatus(data.detail || "Failed to load pending requests.", true);
    }

    renderPendingUsers(data);
  } catch (err) {
    pendingTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">Network error while loading pending requests.</td>
      </tr>
    `;
    setStatus("Network error while loading pending requests.", true);
  }
}

async function loadAuditLogs() {
  if (auditTableBody) {
    auditTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-cell">Loading audit logs...</td>
      </tr>
    `;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/audit-logs?limit=100`, {
      headers: authHeaders()
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 401 || res.status === 403) return forceLogout();
    if (!res.ok) {
      auditTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-cell">Failed to load audit logs.</td>
        </tr>
      `;
      return setStatus(data.detail || "Failed to load audit logs.", true);
    }

    renderAuditLogs(data);
  } catch (err) {
    auditTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-cell">Network error while loading audit logs.</td>
      </tr>
    `;
    setStatus("Network error while loading audit logs.", true);
  }
}

userTableBody?.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit-user]");
  const deleteBtn = e.target.closest("[data-delete-user]");

  if (editBtn) {
    const id = editBtn.getAttribute("data-edit-user");
    const user = cachedUsers.find(u => String(u.id) === String(id));
    if (!user) return;
    showEditUser(user);
    return;
  }

  if (deleteBtn) {
    const id = deleteBtn.getAttribute("data-delete-user");
    const ok = confirm("Delete this user? They will no longer be able to login.");
    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE}/admin/users/${id}`, {
        method: "DELETE",
        headers: authHeaders()
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401 || res.status === 403) return forceLogout();
      if (!res.ok) return setStatus(data.detail || "Delete failed.", true);

      setStatus("User deleted.");
      await loadUsers();
      await loadPendingUsers();
      await loadAuditLogs();
      hideEditUser();
    } catch (err) {
      setStatus("Network error while deleting user.", true);
    }
  }
});

createUserForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    username: createUsername.value.trim(),
    password: createPassword.value,
    first_name: createFirstName.value.trim(),
    last_name: createLastName.value.trim(),
    email: createEmail.value.trim(),
    department: createDepartment.value.trim(),
    role: createRole.value
  };

  setCreateUserStatus("Creating user...");

  try {
    const res = await fetch(`${API_BASE}/admin/users`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 401 || res.status === 403) return forceLogout();
    if (!res.ok) return setCreateUserStatus(data.detail || "Failed to create user.", true);

    setCreateUserStatus("User created successfully.");

    createUsername.value = "";
    createPassword.value = "";
    createFirstName.value = "";
    createLastName.value = "";
    createEmail.value = "";
    createDepartment.value = "";
    createRole.value = "admin";

    await loadUsers();
    await loadAuditLogs();
  } catch (err) {
    setCreateUserStatus("Network error while creating user.", true);
  }
});

pendingTableBody?.addEventListener("click", async (e) => {
  const approveBtn = e.target.closest("[data-approve-user]");
  const denyBtn = e.target.closest("[data-deny-user]");

  if (approveBtn) {
    const id = approveBtn.getAttribute("data-approve-user");
    const roleSelect = document.querySelector(`[data-approve-role="${id}"]`);
    const role = roleSelect ? roleSelect.value : "clinician";

    try {
      const res = await fetch(`${API_BASE}/admin/pending-users/${id}/approve`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ role })
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401 || res.status === 403) return forceLogout();
      if (!res.ok) return setStatus(data.detail || "Approval failed.", true);

      setStatus("User approved.");
      await loadUsers();
      await loadPendingUsers();
      await loadAuditLogs();
    } catch (err) {
      setStatus("Network error while approving user.", true);
    }
    return;
  }

  if (denyBtn) {
    const id = denyBtn.getAttribute("data-deny-user");
    const reasonBox = document.querySelector(`[data-deny-reason="${id}"]`);
    const reason = reasonBox ? reasonBox.value.trim() : "";

    if (!reason) {
      setStatus("Please provide a reason for denial.", true);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/admin/pending-users/${id}/deny`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ reason })
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401 || res.status === 403) return forceLogout();
      if (!res.ok) return setStatus(data.detail || "Denial failed.", true);

      setStatus("Request denied.");
      await loadPendingUsers();
      await loadAuditLogs();
    } catch (err) {
      setStatus("Network error while denying user.", true);
    }
  }
});

editUserForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = editingUserId.value;
  if (!id) return;

  const payload = {
    first_name: editUserFirstName.value.trim(),
    last_name: editUserLastName.value.trim(),
    role: editUserRole.value,
    department: editUserDepartment.value.trim()
  };

  try {
    const res = await fetch(`${API_BASE}/admin/users/${id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 401 || res.status === 403) return forceLogout();
    if (!res.ok) return setStatus(data.detail || "Update failed.", true);

    setStatus("User updated.");
    await loadUsers();
    await loadAuditLogs();
    hideEditUser();
  } catch (err) {
    setStatus("Network error while updating user.", true);
  }
});

btnCancelUserEdit?.addEventListener("click", hideEditUser);
btnRefreshUsers?.addEventListener("click", loadUsers);
btnRefreshPending?.addEventListener("click", loadPendingUsers);
btnRefreshAudit?.addEventListener("click", loadAuditLogs);

document.addEventListener("DOMContentLoaded", () => {
  loadUsers();
  loadPendingUsers();
  loadAuditLogs();
});