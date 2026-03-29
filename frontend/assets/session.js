const SESSION_KEYS = {
  token: "cardiox_token",
  role: "cardiox_role",
  username: "cardiox_username"
};

function getSession() {
  return {
    token: localStorage.getItem(SESSION_KEYS.token),
    role: localStorage.getItem(SESSION_KEYS.role),
    username: localStorage.getItem(SESSION_KEYS.username)
  };
}

function isLoggedIn() {
  const session = getSession();
  return Boolean(session.token && session.role && session.username);
}

function getDashboardUrlByRole(role) {
  if (role === "admin") return "admin.html";
  if (role === "clinician") return "clinician.html";
  return "index.html";
}

function getRoleLabel(role) {
  const map = {
    admin: "Admin",
    clinician: "Clinician",
    manager: "Manager",
    employee: "Employee",
    it_technician: "IT Technician"
  };
  return map[role] || "User";
}

function logoutUser() {
  localStorage.removeItem(SESSION_KEYS.token);
  localStorage.removeItem(SESSION_KEYS.role);
  localStorage.removeItem(SESSION_KEYS.username);
  window.location.replace("login.html");
}