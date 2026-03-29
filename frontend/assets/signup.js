const SIGNUP_URL = "http://127.0.0.1:8000/auth/signup";

const signupForm = document.getElementById("signupForm");
const signupStatus = document.getElementById("signupStatus");
const btnSignupSubmit = document.getElementById("btnSignupSubmit");

const signupFirstName = document.getElementById("signupFirstName");
const signupLastName = document.getElementById("signupLastName");
const signupEmail = document.getElementById("signupEmail");
const signupDepartment = document.getElementById("signupDepartment");
const signupPassword = document.getElementById("signupPassword");
const signupConfirmPassword = document.getElementById("signupConfirmPassword");

function setSignupStatus(message, isError = false) {
  if (!signupStatus) return;
  signupStatus.textContent = message;
  signupStatus.style.color = isError ? "#dc2626" : "#475569";
}

function setSignupButtonLoading(isLoading) {
  if (!btnSignupSubmit) return;
  btnSignupSubmit.disabled = isLoading;
  btnSignupSubmit.textContent = isLoading ? "Submitting Request..." : "Request Access";
}

function capitaliseWords(value) {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function lettersOnlyName(value) {
  return /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/.test(value.trim());
}

function isStrongPassword(value) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{6,}$/.test(value);
}

[signupFirstName, signupLastName].forEach(input => {
  input?.addEventListener("blur", () => {
    input.value = capitaliseWords(input.value);
  });
});

signupDepartment?.addEventListener("blur", () => {
  signupDepartment.value = capitaliseWords(signupDepartment.value);
});

signupEmail?.addEventListener("blur", () => {
  signupEmail.value = signupEmail.value.trim().toLowerCase();
});

signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setSignupStatus("");

  const firstName = capitaliseWords(signupFirstName.value);
  const lastName = capitaliseWords(signupLastName.value);
  const email = signupEmail.value.trim().toLowerCase();
  const department = capitaliseWords(signupDepartment.value);
  const password = signupPassword.value;
  const confirmPassword = signupConfirmPassword.value;

  signupFirstName.value = firstName;
  signupLastName.value = lastName;
  signupEmail.value = email;
  signupDepartment.value = department;

  if (!firstName || !lastName || !email || !department || !password || !confirmPassword) {
    return setSignupStatus("Please complete all required fields.", true);
  }

  if (!lettersOnlyName(firstName)) {
    signupFirstName.focus();
    return setSignupStatus("First name must contain letters only.", true);
  }

  if (!lettersOnlyName(lastName)) {
    signupLastName.focus();
    return setSignupStatus("Surname must contain letters only.", true);
  }

  if (!isStrongPassword(password)) {
    signupPassword.focus();
    return setSignupStatus(
      "Password must be at least 6 characters and include 1 uppercase letter, 1 lowercase letter, and 1 symbol.",
      true
    );
  }

  if (password !== confirmPassword) {
    signupConfirmPassword.focus();
    return setSignupStatus("Passwords do not match.", true);
  }

  setSignupButtonLoading(true);
  setSignupStatus("Submitting access request...");

  try {
    const res = await fetch(SIGNUP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email,
        department,
        password
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setSignupButtonLoading(false);
      return setSignupStatus(data.detail || "Failed to submit access request.", true);
    }

    signupForm.reset();
    setSignupButtonLoading(false);
    setSignupStatus(
      `Access request submitted successfully. Your generated username is ${data.generated_username}. Please wait for administrator approval.`
    );
  } catch (err) {
    setSignupButtonLoading(false);
    setSignupStatus("Network error. Please make sure the backend is running.", true);
  }
});