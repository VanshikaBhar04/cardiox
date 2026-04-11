// --------------------------------------------------
// Shared Logout Handler (uses central session logic)
// --------------------------------------------------

// Attach logout to ALL buttons with id="btnLogout"
document.addEventListener("DOMContentLoaded", () => {
  const logoutButtons = document.querySelectorAll("#btnLogout");

  logoutButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      logoutUser(); // Uses centralised session.js function
    });
  });
});