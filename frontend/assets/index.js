document.addEventListener("DOMContentLoaded", () => {
  const session = getSession();

  const navLinks = document.getElementById("navLinks");
  const heroPrimaryCta = document.getElementById("heroPrimaryCta");
  const heroSecondaryCta = document.getElementById("heroSecondaryCta");
  const sessionBanner = document.getElementById("sessionBanner");
  const sessionBannerTitle = document.getElementById("sessionBannerTitle");
  const sessionBannerText = document.getElementById("sessionBannerText");
  const sessionBannerBtn = document.getElementById("sessionBannerBtn");

  if (!navLinks || !heroPrimaryCta || !heroSecondaryCta) return;

  if (isLoggedIn()) {
    const dashboardUrl = getDashboardUrlByRole(session.role);
    const roleLabel = getRoleLabel(session.role);

    navLinks.innerHTML = `
      <a href="index.html" class="active">Home</a>
      <a href="${dashboardUrl}">${session.role === "admin" ? "User Management" : "Patient Management"}</a>
      <a href="help.html">Help & Support</a>
      <a href="compliance.html">Safety & Compliance</a>
      <span class="nav-session-badge">${roleLabel} · ${session.username}</span>
      <button id="navLogoutBtn" type="button" class="nav-logout-btn">Log out</button>
    `;

    heroPrimaryCta.textContent = `Continue to ${session.role === "admin" ? "User Management" : "Patient Management"}`;
    heroPrimaryCta.href = dashboardUrl;

    heroSecondaryCta.textContent = "Help & Support";
    heroSecondaryCta.href = "help.html";

    if (sessionBanner && sessionBannerTitle && sessionBannerText && sessionBannerBtn) {
      sessionBanner.style.display = "flex";
      sessionBannerTitle.textContent = `Welcome back, ${session.username}`;
      sessionBannerText.textContent =
        session.role === "admin"
          ? "Your admin session is still active. Continue managing users, approvals, and audit activity."
          : "Your clinician session is still active. Continue with patient management and assessment workflow.";
      sessionBannerBtn.textContent =
        session.role === "admin" ? "Go to User Management" : "Go to Patient Management";
      sessionBannerBtn.href = dashboardUrl;
    }

    document.getElementById("navLogoutBtn")?.addEventListener("click", logoutUser);
  } else {
    navLinks.innerHTML = `
      <a href="index.html" class="active">Home</a>
      <a href="about.html">About Us</a>
      <a href="features.html">Features</a>
      <a href="contact.html">Contact Us</a>
      <a href="safety.html">Clinical Safety</a>
      <a href="login.html" class="nav-login-btn">Login</a>
    `;

    heroPrimaryCta.textContent = "Login to CardioX";
    heroPrimaryCta.href = "login.html";

    heroSecondaryCta.textContent = "Learn More";
    heroSecondaryCta.href = "about.html";

    if (sessionBanner) {
      sessionBanner.style.display = "none";
    }
  }
});