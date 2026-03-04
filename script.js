// ===============================
// SIGNUP & LOGIN VALIDATION
// ===============================
document.addEventListener("DOMContentLoaded", function () {
  // ===============================
  // SIGNUP VALIDATION
  // ===============================
  const signupForm = document.getElementById("signupForm");

  if (signupForm) {
    signupForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const name = signupForm.querySelector('input[type="text"]').value.trim();
      const email = signupForm
        .querySelector('input[type="email"]')
        .value.trim();
      const passwords = signupForm.querySelectorAll('input[type="password"]');
      const password = passwords[0].value;
      const confirmPassword = passwords[1].value;

      // Name validation
      if (name.length < 3) {
        alert("Full name must be at least 3 characters.");
        return;
      }

      // Stronger email validation
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!emailPattern.test(email)) {
        alert("Please enter a valid email address.");
        return;
      }

      // Password length
      if (password.length < 6) {
        alert("Password must be at least 6 characters.");
        return;
      }

      // Password match
      if (password !== confirmPassword) {
        alert("Passwords do not match.");
        return;
      }

      // Prevent duplicate account
      const existingEmail = localStorage.getItem("userEmail");
      if (existingEmail && existingEmail === email) {
        alert("Account already exists. Please login.");
        return;
      }

      // Save user data
      localStorage.setItem("userName", name);
      localStorage.setItem("userEmail", email);
      localStorage.setItem("userPassword", password);
      localStorage.setItem("isLoggedIn", "false");

      alert("Account created successfully!");
      window.location.href = "login.html";
    });
  }

  // ===============================
  // LOGIN VALIDATION
  // ===============================
  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const email = loginForm.querySelector('input[type="email"]').value.trim();
      const password = loginForm.querySelector('input[type="password"]').value;

      const storedEmail = localStorage.getItem("userEmail");
      const storedPassword = localStorage.getItem("userPassword");

      // Empty fields check
      if (email === "" || password === "") {
        alert("Please fill in all fields.");
        return;
      }

      // Email existence check
      if (!storedEmail || email !== storedEmail) {
        alert("Email not found. Please sign up first.");
        return;
      }

      // Password check
      if (password !== storedPassword) {
        alert("Incorrect password.");
        return;
      }

      // Successful login
      localStorage.setItem("isLoggedIn", "true");
      alert("Login successful!");
      window.location.href = "index.html";
    });
  }
});
