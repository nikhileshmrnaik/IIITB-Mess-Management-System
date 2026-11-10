"use strict";

const API_BASE = "/api/admin";

const bookingDateInput = document.getElementById("bookingDate");
const mealFilter = document.getElementById("mealFilter");
const bookingTableBody = document.getElementById("bookingTableBody");
const pageMessage = document.getElementById("pageMessage");

const meals = ["breakfast", "lunch", "dinner"];

function getTodayDate() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());

    const values = {};

    parts.forEach(part => {
        values[part.type] = part.value;
    });

    return `${values.year}-${values.month}-${values.day}`;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function getToken() {
    return localStorage.getItem("messToken");
}

async function apiRequest(url, options = {}) {
    const token = getToken();

    if (!token) {
        localStorage.removeItem("messUser");
        window.location.replace("/login.html");
        throw new Error("Please log in again.");
    }

    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...options.headers
        }
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
        localStorage.removeItem("messToken");
        localStorage.removeItem("messUser");
        window.location.replace("/login.html");
        throw new Error("Your session has expired. Please log in again.");
    }

    if (response.status === 403) {
        throw new Error(
            data.message || "You are not authorized to access this page."
        );
    }

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
    }

    return data;
}

function showMessage(message, isError = false) {
    pageMessage.textContent = message;
    pageMessage.style.color = isError ? "#dc2626" : "#15803d";
}

function formatDeadlineForInput(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(date);

    const values = {};

    parts.forEach(part => {
        values[part.type] = part.value;
    });

    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function formatDeadlineForServer(value) {
    // datetime-local is interpreted in the browser's local timezone.
    // Convert it to an ISO timestamp with an explicit timezone.
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toISOString();
}

async function loadDeadlines() {
    const date = bookingDateInput.value;

    if (!date) return;

    try {
        const data = await apiRequest(
            `${API_BASE}/deadlines?date=${encodeURIComponent(date)}`
        );

        const deadlines = data.deadlines || [];

        meals.forEach(meal => {
            const deadline = deadlines.find(
                item => item.mealType === meal
            );

            const input = document.getElementById(`${meal}Deadline`);
            const status = document.getElementById(`${meal}Status`);

            if (!input || !status) return;

            input.value = deadline
                ? formatDeadlineForInput(deadline.deadlineAt)
                : "";

            status.textContent = deadline
                ? `Saved deadline: ${new Date(
                    deadline.deadlineAt
                ).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata"
                })}`
                : "No deadline configured yet.";
        });

    } catch (error) {
        showMessage(error.message, true);
    }
}

async function saveDeadline(meal) {
    const date = bookingDateInput.value;
    const input = document.getElementById(`${meal}Deadline`);
    const status = document.getElementById(`${meal}Status`);

    if (!date) {
        showMessage("Please select a booking date first.", true);
        return;
    }

    if (!input.value) {
        showMessage(`Please select a deadline for ${meal}.`, true);
        return;
    }

    const deadlineAt = formatDeadlineForServer(input.value);

    if (!deadlineAt) {
        showMessage("Please enter a valid deadline.", true);
        return;
    }

    try {
        status.textContent = "Saving...";

        const data = await apiRequest(`${API_BASE}/deadlines`, {
            method: "POST",
            body: JSON.stringify({
                bookingDate: date,
                mealType: meal,
                deadlineAt
            })
        });

        status.textContent = "Deadline saved successfully.";

        showMessage(
            data.message || `${meal} deadline updated successfully.`
        );

    } catch (error) {
        status.textContent = "Could not save deadline.";
        showMessage(error.message, true);
    }
}

function updateSummary(summary = []) {
    const counts = {
        breakfast: 0,
        lunch: 0,
        dinner: 0
    };

    // Backend returns an array:
    // [{ mealType, totalBookings, activeBookings, cancelledBookings }]
    if (Array.isArray(summary)) {
        summary.forEach(item => {
            if (counts.hasOwnProperty(item.mealType)) {
                counts[item.mealType] =
                    Number(item.activeBookings || 0);
            }
        });
    }

    document.getElementById("breakfastCount").textContent =
        counts.breakfast;

    document.getElementById("lunchCount").textContent =
        counts.lunch;

    document.getElementById("dinnerCount").textContent =
        counts.dinner;

    document.getElementById("totalCount").textContent =
        counts.breakfast + counts.lunch + counts.dinner;
}

function renderBookings(bookings = []) {
    if (!bookings.length) {
        bookingTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-message">
                    No bookings found for this selection.
                </td>
            </tr>
        `;
        return;
    }

    bookingTableBody.innerHTML = bookings.map(booking => {
        const student = booking.student || {};
        const status = String(booking.status || "").toLowerCase();

        const statusClass = status === "cancelled"
            ? "status-cancelled"
            : "status-booked";

        return `
            <tr>
                <td>${escapeHTML(student.name || "Unknown")}</td>
                <td>${escapeHTML(student.email || "—")}</td>
                <td>${escapeHTML(booking.mealType || "—")}</td>
                <td>${escapeHTML(booking.bookingDate || "—")}</td>
                <td class="${statusClass}">
                    ${escapeHTML(status || "Unknown")}
                </td>
            </tr>
        `;
    }).join("");
}

async function loadBookings() {
    const date = bookingDateInput.value;
    const selectedMeal = mealFilter.value;

    if (!date) {
        showMessage("Please select a booking date.", true);
        return;
    }

    try {
        showMessage("Loading bookings...");

        const query = new URLSearchParams({ date });

        if (selectedMeal !== "all") {
            query.set("mealType", selectedMeal);
        }

        const data = await apiRequest(
            `${API_BASE}/bookings?${query.toString()}`
        );

        updateSummary(data.summary || []);
        renderBookings(data.bookings || []);

        showMessage(
            `Bookings loaded successfully. Total records: ${data.totalBookings ?? 0}`
        );

    } catch (error) {
        bookingTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-message">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;

        showMessage(error.message, true);
    }
}

// Load button.
document.getElementById("loadBookingsBtn")
    .addEventListener("click", async () => {
        await loadDeadlines();
        await loadBookings();
    });

// Save individual meal deadlines.
document.querySelectorAll(".save-deadline").forEach(button => {
    button.addEventListener("click", () => {
        saveDeadline(button.dataset.meal);
    });
});

// Change meal filter.
mealFilter.addEventListener("change", loadBookings);

// Change selected date and reload deadlines.
bookingDateInput.addEventListener("change", async () => {
    await loadDeadlines();
    await loadBookings();
});

// Initialize.
bookingDateInput.value = getTodayDate();

loadDeadlines();
loadBookings();