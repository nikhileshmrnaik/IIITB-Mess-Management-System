
// Display the current year in the footer
document.getElementById("currentYear").textContent =
    new Date().getFullYear();

// Mobile navigation
const mobileMenu = document.getElementById("mobileMenu");
const navLinks = document.querySelector(".nav-links");

mobileMenu.addEventListener("click", () => {
    navLinks.classList.toggle("mobile-open");
});

// Close mobile navigation after clicking a link
document.querySelectorAll(".nav-links a").forEach(link => {
    link.addEventListener("click", () => {
        navLinks.classList.remove("mobile-open");
    });
});
