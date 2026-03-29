// Shared logout logic across the app

function clearSession() {
  localStorage.removeItem("cardiox_token");
  localStorage.removeItem("cardiox_role");
  localStorage.removeItem("cardiox_username");
}

function logout() {
  clearSession();
  window.location.replace("login.html");
}

// Attach logout to ALL buttons with id="btnLogout"
document.addEventListener("DOMContentLoaded", () => {
  const logoutButtons = document.querySelectorAll("#btnLogout");

  logoutButtons.forEach(btn => {
    btn.addEventListener("click", logout);
  });
});