const API_BASE = "/api";

const deadlineForm = document.getElementById("deadlineForm");
const bookingDateInput = document.getElementById("bookingDate");
const mealTypeInput = document.getElementById("mealType");
const deadlineAtInput = document.getElementById("deadlineAt");
const tableBody = document.getElementById("deadlineTableBody");
const messageBox = document.getElementById("messageBox");
const saveBtn = document.getElementById("saveBtn");
const refreshBtn = document.getElementById("refreshBtn");
const deadlineCount = document.getElementById("deadlineCount");
const logoutBtn = document.getElementById("logoutBtn");

function getToken() {
    return localStorage.getItem("messToken");
}

function showMessage(message, type = "success") {
    messageBox.textContent = message;
    messageBox.className = `message-box ${type}`;
    messageBox.hidden = false;
}

function hideMessage() {
    messageBox.hidden = true;
}

async function apiRequest(url, options = {}) {
    const token = getToken();

    if (!token) {
        localStorage.removeItem("messUser");
        window.location.href = "/";
        throw new Error("Please log in as an administrator.");
    }

    const headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
    };

    if (options.body) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers,
        cache: "no-store"
    });

    const result = await response.json();

    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("messToken");
        localStorage.removeItem("messUser");
        window.location.href = "/";
        throw new Error("Your session is invalid. Please log in again.");
    }

    if (!response.ok || result.success === false) {
        throw new Error(result.message || "Something went wrong.");
    }

    return result;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function formatDeadline(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Invalid date";
    }

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
}

function formatDate(value) {
    if (!value) return "";

    const [year, month, day] = value.split("-");
    return `${day}-${month}-${year}`;
}

function toLocalDateTimeInput(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const offset = date.getTimezoneOffset() * 60000;

    return new Date(date.getTime() - offset)
        .toISOString()
        .slice(0, 16);
}

// Load all configured deadlines
async function loadDeadlines() {
    tableBody.innerHTML =
        '<tr><td colspan="3">Loading deadlines...</td></tr>';

    try {
        const result = await apiRequest("/admin/deadlines");

        const deadlines = result.deadlines || [];

        deadlineCount.textContent =
            `Total deadlines: ${deadlines.length}`;

        if (deadlines.length === 0) {
            tableBody.innerHTML =
                '<tr><td colspan="3">No deadlines configured yet.</td></tr>';
            return;
        }

        tableBody.innerHTML = deadlines.map((deadline, index) => `
            <tr>
                <td>${escapeHTML(formatDate(deadline.bookingDate))}</td>
                <td>${escapeHTML(
                    deadline.mealType.charAt(0).toUpperCase() +
                    deadline.mealType.slice(1)
                )}</td>
                <td>
                    ${escapeHTML(formatDeadline(deadline.deadlineAt))}
                    <button
                        type="button"
                        class="edit-deadline-btn"
                        data-index="${index}"
                    >
                        Edit
                    </button>
                </td>
            </tr>
        `).join("");

        // Store the records for the Edit buttons.
        window.currentDeadlines = deadlines;

    } catch (error) {
        tableBody.innerHTML =
            '<tr><td colspan="3">Unable to load deadlines.</td></tr>';

        showMessage(error.message, "error");
    }
}

// Save a new deadline or update an existing one
deadlineForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    hideMessage();

    const bookingDate = bookingDateInput.value;
    const mealType = mealTypeInput.value;
    const localDeadline = deadlineAtInput.value;

    if (!bookingDate || !mealType || !localDeadline) {
        showMessage("Please fill in all the fields.", "error");
        return;
    }

    const deadlineDate = new Date(localDeadline);

    if (Number.isNaN(deadlineDate.getTime())) {
        showMessage("Please enter a valid deadline.", "error");
        return;
    }

    // Convert local date and time into an ISO timestamp with timezone.
    const deadlineAt = deadlineDate.toISOString();

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
        const result = await apiRequest("/admin/deadlines", {
            method: "POST",
            body: JSON.stringify({
                bookingDate,
                mealType,
                deadlineAt
            })
        });

        showMessage(
            result.message || "Deadline saved successfully.",
            "success"
        );

        deadlineForm.reset();
        await loadDeadlines();

    } catch (error) {
        showMessage(error.message, "error");
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Deadline";
    }
});

// Edit an existing deadline
tableBody.addEventListener("click", function (event) {
    const button = event.target.closest(".edit-deadline-btn");

    if (!button) return;

    const index = Number(button.dataset.index);
    const deadline = window.currentDeadlines?.[index];

    if (!deadline) return;

    bookingDateInput.value = deadline.bookingDate;
    mealTypeInput.value = deadline.mealType;
    deadlineAtInput.value = toLocalDateTimeInput(deadline.deadlineAt);

    saveBtn.textContent = "Update Deadline";

    showMessage(
        "Deadline loaded into the form. Change the details and click Update Deadline.",
        "success"
    );

    deadlineForm.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
});

// Refresh the deadline list
refreshBtn.addEventListener("click", function () {
    hideMessage();
    loadDeadlines();
});

// Logout
logoutBtn.addEventListener("click", function () {
    localStorage.removeItem("messToken");
    localStorage.removeItem("messUser");
    window.location.href = "/";
});

// Initial loading
loadDeadlines();