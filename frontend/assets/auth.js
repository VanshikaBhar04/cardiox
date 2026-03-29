const AUTH_URL = "http://127.0.0.1:8000/auth/login";

const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("status");
const btnLoginSubmit = document.getElementById("btnLoginSubmit");

function setSession({ access_token, role, username }) {
  localStorage.setItem("cardiox_token", access_token);
  localStorage.setItem("cardiox_role", role);
  localStorage.setItem("cardiox_username", username);
}

function setLoginStatus(message, isError = false) {
  if (!loginStatus) return;
  loginStatus.textContent = message;
  loginStatus.style.color = isError ? "#dc2626" : "#475569";
}

function setLoginButtonLoading(isLoading) {
  if (!btnLoginSubmit) return;
  btnLoginSubmit.disabled = isLoading;
  btnLoginSubmit.textContent = isLoading ? "Signing In..." : "Sign in";
}

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !password) {
    return setLoginStatus("Please enter your username and password.", true);
  }

  setLoginButtonLoading(true);
  setLoginStatus("Signing in...");

  try {
    const res = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setLoginButtonLoading(false);
      return setLoginStatus(data.detail || "Login failed.", true);
    }

    setSession(data);

    if (data.role === "admin") {
      window.location.href = "admin.html";
    } else if (data.role === "clinician") {
      window.location.href = "clinician.html";
    } else {
      window.location.href = "index.html";
    }
  } catch (err) {
    setLoginButtonLoading(false);
    setLoginStatus("Network error. Please make sure the backend is running.", true);
  }
});
