document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById("loginBtn");
    const signupBtn = document.getElementById("signupBtn");
    const loginUsernameInput = document.getElementById("loginUsername");
    const loginPasswordInput = document.getElementById("loginPassword");
    const signupUsernameInput = document.getElementById("signupUsername");
    const signupPasswordInput = document.getElementById("signupPassword");
    const loginError = document.getElementById("loginError");
    const signupError = document.getElementById("signupError");

    if (loginBtn) {
        loginBtn.addEventListener("click", async () => {
            const username = loginUsernameInput.value.trim();
            const password = loginPasswordInput.value.trim();

            if (!username || !password) {
                loginError.textContent = "Please enter both username and password.";
                loginError.style.display = "block";
                return;
            }

            try {
                const response = await fetch("https://api.jsonbin.io/v3/qs/67da88158960c979a574a348");
                if (!response.ok) throw new Error("Failed to fetch users.");
                const data = await response.json();
                const users = data.record.users; // Access nested 'users' array

                const user = users.find(u => u.username === username && u.password === password);
                if (user) {
                    localStorage.setItem("isAuthenticated", "true");
                    localStorage.setItem("username", username);
                    window.location.href = "index.html";
                } else {
                    loginError.textContent = "Invalid username or password.";
                    loginError.style.display = "block";
                }
            } catch (error) {
                console.error("Login error:", error);
                loginError.textContent = "An error occurred. Please try again.";
                loginError.style.display = "block";
            }
        });

        loginPasswordInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") loginBtn.click();
        });
    }

    if (signupBtn) {
        signupBtn.addEventListener("click", async () => {
            const username = signupUsernameInput.value.trim();
            const password = signupPasswordInput.value.trim();

            if (!username || !password) {
                signupError.textContent = "Please enter both username and password.";
                signupError.style.display = "block";
                return;
            }

            try {
                const usersResponse = await fetch("https://api.jsonbin.io/v3/qs/67da89b88960c979a574a405");
                if (!usersResponse.ok) throw new Error("Failed to fetch users.");
                const data = await usersResponse.json();
                const users = data.record.users; // Access nested 'users' array

                if (users.find(u => u.username === username)) {
                    signupError.textContent = "Username already exists.";
                    signupError.style.display = "block";
                    return;
                }

                const newUser = {
                    id: users.length + 1,
                    username: username,
                    password: password
                };

                // Note: JSONbin is read-only, so POST won't work directly.
                // This is a placeholder for a writable endpoint.
                const signupResponse = await fetch("https://api.jsonbin.io/v3/qs/67da89b88960c979a574a405", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(newUser)
                });

                if (!signupResponse.ok) throw new Error("Failed to sign up. JSONbin is read-only; use a writable endpoint for signup.");

                // Show success popup
                const overlay = document.createElement("div");
                overlay.style.position = "fixed";
                overlay.style.top = "0";
                overlay.style.left = "0";
                overlay.style.width = "100%";
                overlay.style.height = "100%";
                overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
                overlay.style.zIndex = "1000";
                overlay.style.display = "flex";
                overlay.style.justifyContent = "center";
                overlay.style.alignItems = "center";
                overlay.style.opacity = "0";
                overlay.style.transition = "opacity 0.3s ease";

                const popup = document.createElement("div");
                popup.style.backgroundColor = "white";
                popup.style.padding = "20px";
                popup.style.borderRadius = "8px";
                popup.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
                popup.style.textAlign = "center";
                popup.innerHTML = `
                    <h2>Success!</h2>
                    <p>Account created successfully. Redirecting to login...</p>
                `;

                overlay.appendChild(popup);
                document.body.appendChild(overlay);

                setTimeout(() => {
                    overlay.style.opacity = "1";
                }, 10);

                setTimeout(() => {
                    overlay.style.opacity = "0";
                    setTimeout(() => {
                        overlay.remove();
                        window.location.href = "login.html"; // Redirect to login
                    }, 300);
                }, 1500); // Show popup for 1.5 seconds

                signupUsernameInput.value = "";
                signupPasswordInput.value = "";
                signupError.style.display = "none";
            } catch (error) {
                console.error("Signup error:", error);
                signupError.textContent = "An error occurred during signup. JSONbin is read-only; signup requires a writable endpoint.";
                signupError.style.display = "block";
            }
        });
    }
});