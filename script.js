document.addEventListener("DOMContentLoaded", function () {

  // ===============================
  // AUTO CREATE DEFAULT ADMIN ACCOUNT
  // ===============================
  if (!localStorage.getItem("users")) {
    const defaultAdmin = {
      id: 1,
      name: "Administrator",
      email: "admin@cj4.com",
      password: "admin123",
      role: "admin"
    };
    localStorage.setItem("users", JSON.stringify([defaultAdmin]));
    console.log("Default admin created!");
  }

  // ===============================
  // SIGNUP FORM HANDLER
  // ===============================
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const name = signupForm.querySelector('input[name="name"]').value.trim();
      const email = signupForm.querySelector('input[name="email"]').value.trim().toLowerCase();
      const passwords = signupForm.querySelectorAll('input[type="password"]');
      const password = passwords[0].value;
      const confirmPassword = passwords[1].value;
      const roleSelect = signupForm.querySelector('select[name="role"]');
      const role = roleSelect ? roleSelect.value : "user";

      // ===== Validation =====
      if (name.length < 3) { 
        alert("Full name must be at least 3 characters."); 
        return; 
      }
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!emailPattern.test(email)) { 
        alert("Please enter a valid email."); 
        return; 
      }
      if (password.length < 6) { 
        alert("Password must be at least 6 characters."); 
        return; 
      }
      if (password !== confirmPassword) { 
        alert("Passwords do not match."); 
        return; 
      }

      let users = JSON.parse(localStorage.getItem("users")) || [];

      // Check duplicate email
      if (users.some(u => u.email.toLowerCase() === email)) {
        alert("Account already exists. Please login.");
        return;
      }

      // ===== Create New User/Admin =====
      const newUser = {
        id: users.length + 1,
        name: name,
        email: email,
        password: password,
        role: role
      };

      users.push(newUser);
      localStorage.setItem("users", JSON.stringify(users));
      alert(`${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully!`);
      window.location.href = "login.html";
    });
  }

  // ===============================
  // LOGIN FORM HANDLER
  // ===============================
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const email = loginForm.querySelector('input[type="email"]').value.trim().toLowerCase();
      const password = loginForm.querySelector('input[type="password"]').value;

      const users = JSON.parse(localStorage.getItem("users")) || [];
      const user = users.find(u => u.email.toLowerCase() === email);

      if (!user) {
        alert("Email not found. Please sign up first.");
        return;
      }

      if (user.password !== password) {
        alert("Incorrect password.");
        return;
      }

      // ===== Save current login =====
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("currentUser", JSON.stringify(user));
      alert("Login successful!");

      if (user.role === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "index.html";
      }
    });
  }

  // ===============================
  // PROTECT ADMIN PAGES
  // ===============================
  const adminPages = ["admin.html", "manage-users.html"];
  const currentPage = window.location.pathname.split("/").pop();

  if (adminPages.includes(currentPage)) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser")) || {};
    if (!currentUser.role || currentUser.role !== "admin") {
      alert("Access denied. Admin only.");
      window.location.href = "login.html";
    }
  }

});