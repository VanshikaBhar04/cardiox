// --------------------------------------------------
// CardioX Session Management
// --------------------------------------------------

// Handles user session storage, retrieval, and validation.
// This module supports authentication persistence across pages
// using browser localStorage.


// --------------------------------------------------
// Session storage keys
// --------------------------------------------------

const SESSION_KEYS = {
  token: "cardiox_token",
  role: "cardiox_role",
  username: "cardiox_username"
};


// --------------------------------------------------
// Session retrieval
// --------------------------------------------------

function getSession() {
  // Retrieves the current session data from localStorage
  return {
    token: localStorage.getItem(SESSION_KEYS.token),
    role: localStorage.getItem(SESSION_KEYS.role),
    username: localStorage.getItem(SESSION_KEYS.username)
  };
}


// --------------------------------------------------
// Authentication state check
// --------------------------------------------------

function isLoggedIn() {
  // Validates that all required session values exist
  const session = getSession();
  return Boolean(session.token && session.role && session.username);
}


// --------------------------------------------------
// Role-based navigation helpers
// --------------------------------------------------

function getDashboardUrlByRole(role) {
  // Determines which dashboard page the user should access
  if (role === "admin") return "admin.html";
  if (role === "clinician") return "clinician.html";
  return "index.html";
}

function getRoleLabel(role) {
  // Converts internal role identifiers into user-friendly labels
  const map = {
    admin: "Admin",
    clinician: "Clinician",
    manager: "Manager",
    employee: "Employee",
    it_technician: "IT Technician"
  };

  return map[role] || "User";
}


// --------------------------------------------------
// Logout handling
// --------------------------------------------------

function logoutUser() {
  // Clears session data and redirects to login page
  localStorage.removeItem(SESSION_KEYS.token);
  localStorage.removeItem(SESSION_KEYS.role);
  localStorage.removeItem(SESSION_KEYS.username);

  window.location.replace("login.html");
}