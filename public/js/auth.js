document.addEventListener("DOMContentLoaded", () => {
    const formMessage = document.getElementById("formMessage");

    const showMessage = (message, type = "error") => {
        if (!formMessage) {
            return;
        }

        formMessage.textContent = message;
        formMessage.className = `form-message ${type}`;
    };

    document.querySelectorAll(".toggle-password").forEach(button => {
        button.addEventListener("click", () => {
            const input = document.getElementById(button.dataset.target);

            if (!input) {
                return;
            }

            const showPassword = input.type === "password";
            input.type = showPassword ? "text" : "password";
            button.textContent = showPassword ? "Hide" : "Show";
        });
    });

    const loginForm = document.getElementById("loginForm");

    if (loginForm) {
        loginForm.addEventListener("submit", async event => {
            event.preventDefault();

            const button = document.getElementById("loginButton");
            const originalText = button.textContent;
            button.disabled = true;
            button.textContent = "Signing in...";

            try {
                const response = await fetch("/api/auth/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: document.getElementById("email").value.trim(),
                        password: document.getElementById("password").value
                    })
                });
                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.message || "Unable to sign in.");
                }

                if (!result.token || !result.user) {
                    throw new Error("The server returned an invalid login response.");
                }

                let destination;

                if (result.user.role === "admin") {
                    destination = "/admin/dashboard.html";
                } else if (result.user.role === "student") {
                    destination = "/student/dashboard.html";
                } else {
                    throw new Error("This account has an unsupported role.");
                }

                localStorage.setItem("messToken", result.token);
                localStorage.setItem("messUser", JSON.stringify(result.user));
                window.location.href = destination;
            } catch (error) {
                console.error("Login error:", error);
                showMessage(
                    error instanceof TypeError
                        ? "Unable to connect to the server. Please try again."
                        : error.message
                );
            } finally {
                button.disabled = false;
                button.textContent = originalText;
            }
        });
    }

    const registerForm = document.getElementById("registerForm");

    if (registerForm) {
        registerForm.addEventListener("submit", async event => {
            event.preventDefault();

            const password = document.getElementById("password").value;
            const confirmPassword =
                document.getElementById("confirmPassword").value;

            if (password !== confirmPassword) {
                showMessage("Passwords do not match.");
                return;
            }

            const button = document.getElementById("registerButton");
            const originalText = button.textContent;
            button.disabled = true;
            button.textContent = "Creating account...";

            try {
                const response = await fetch("/api/auth/register", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        name: document.getElementById("name").value.trim(),
                        email: document.getElementById("email").value.trim(),
                        student_id:
                            document.getElementById("student_id").value.trim(),
                        department:
                            document.getElementById("department").value,
                        hostel: document.getElementById("hostel").value.trim(),
                        room_number:
                            document.getElementById("room_number").value.trim(),
                        password
                    })
                });
                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(
                        result.message || "Unable to create your account."
                    );
                }

                if (!result.token || !result.user || result.user.role !== "student") {
                    throw new Error(
                        "The server returned an invalid registration response."
                    );
                }

                localStorage.setItem("messToken", result.token);
                localStorage.setItem("messUser", JSON.stringify(result.user));
                window.location.href = "/student/dashboard.html";
            } catch (error) {
                console.error("Registration error:", error);
                showMessage(
                    error instanceof TypeError
                        ? "Unable to connect to the server. Please try again."
                        : error.message
                );
            } finally {
                button.disabled = false;
                button.textContent = originalText;
            }
        });
    }
});
