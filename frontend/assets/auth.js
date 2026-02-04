const AUTH_URL = "http://127.0.0.1:8000/auth/login";

// Save session to localStorage
function setSession({ access_token, role, username }) {
  localStorage.setItem("cardiox_token", access_token);
  localStorage.setItem("cardiox_role", role);
  localStorage.setItem("cardiox_username", username);
}

// Optional helpers
function getToken() {
  return localStorage.getItem("cardiox_token");
}

function clearSession() {
  localStorage.removeItem("cardiox_token");
  localStorage.removeItem("cardiox_role");
  localStorage.removeItem("cardiox_username");
}

// Handle login form submission
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const status = document.getElementById("status");
  status.textContent = "Signing in...";

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      status.textContent = data.detail || "Login failed";
      return;
    }

    // Store token + role + username
    setSession(data);

    // Redirect based on role
    if (data.role === "admin") {
      window.location.href = "admin.html";
    } else if (data.role === "clinician") {
      window.location.href = "clinician.html";
    } else {
      window.location.href = "index.html";
    }
  } catch (err) {
    status.textContent = "Network error. Is the backend running?";
  }
});
