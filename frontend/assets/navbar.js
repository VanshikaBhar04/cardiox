// --------------------------------------------------
// CardioX Navbar Script
// --------------------------------------------------

// Loads the shared navigation bar, updates it based on session state,
// and highlights the active page for a clearer user experience.


// --------------------------------------------------
// Navbar loading
// --------------------------------------------------

function loadNavbar() {
  // Loads the shared navbar HTML into the current page
  const navbarContainer = document.getElementById("navbarContainer");
  if (!navbarContainer) return;

  fetch("navbar.html")
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to load navbar.html (${res.status})`);
      }
      return res.text();
    })
    .then((html) => {
      navbarContainer.innerHTML = html;
      initialiseNavbar();
    })
    .catch((err) => {
      console.error("Failed to load navbar:", err);
    });
}


// --------------------------------------------------
// Navbar initialisation
// --------------------------------------------------

function initialiseNavbar() {
  // Reads session data and updates navbar links for the current user state
  const token = localStorage.getItem("cardiox_token");
  const role = localStorage.getItem("cardiox_role");
  const username = localStorage.getItem("cardiox_username") || "User";

  const loginBtn = document.getElementById("loginBtn");
  const signupBtn = document.getElementById("signupBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const sessionBadge = document.getElementById("sessionBadge");
  const dashboardLink = document.getElementById("dashboardLink");
  const protectedLinks = document.querySelectorAll(".protected-link");

  const isLoggedIn = Boolean(token && role);

  if (isLoggedIn) {
    protectedLinks.forEach((link) => link.classList.remove("hidden"));

    if (dashboardLink) {
      dashboardLink.classList.remove("hidden");

      if (role === "admin") {
        dashboardLink.textContent = "User Hub";
        dashboardLink.href = "admin.html";
      } else {
        dashboardLink.textContent = "Patient Hub";
        dashboardLink.href = "clinician.html";
      }
    }

    if (sessionBadge) {
      const roleLabel = role === "admin" ? "Admin" : "Clinician";
      sessionBadge.textContent = `${roleLabel} · ${username}`;
      sessionBadge.classList.remove("hidden");
    }

    if (loginBtn) loginBtn.classList.add("hidden");
    if (signupBtn) signupBtn.classList.add("hidden");

    if (logoutBtn) {
      logoutBtn.classList.remove("hidden");

      // Uses centralised logout logic from session.js
      logoutBtn.onclick = logoutUser;
    }
  } else {
    protectedLinks.forEach((link) => link.classList.add("hidden"));

    if (dashboardLink) dashboardLink.classList.add("hidden");
    if (sessionBadge) sessionBadge.classList.add("hidden");
    if (logoutBtn) logoutBtn.classList.add("hidden");
    if (loginBtn) loginBtn.classList.remove("hidden");
    if (signupBtn) signupBtn.classList.remove("hidden");
  }

  highlightActiveLink();
}


// --------------------------------------------------
// Active link highlighting
// --------------------------------------------------

function highlightActiveLink() {
  // Highlights the current page in the navigation bar
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll(".app-nav-link, .nav-login-btn, .nav-signup-btn").forEach((link) => {
    const href = link.getAttribute("href");

    if (href === currentPage) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}


// --------------------------------------------------
// Initial page load
// --------------------------------------------------

document.addEventListener("DOMContentLoaded", loadNavbar);