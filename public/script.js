console.log("=== Script.js loaded ===");

const loginBtn = document.getElementById("login-btn");

console.log("=== DOM Elements Check ===");
console.log("loginBtn element:", loginBtn);

// ログイン関数
function handleLogin() {
  window.location.href = "/login";
}
