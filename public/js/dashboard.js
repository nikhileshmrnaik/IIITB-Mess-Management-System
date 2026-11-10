
"use strict";

// =============================================
// CONFIGURATION
// =============================================

const API_BASE = "/api/student";
const token = localStorage.getItem("messToken");

const MEAL_RATES = {
    breakfast: 30,
    lunch: 60,
    dinner: 50
};

const meals = ["breakfast", "lunch", "dinner"];

let currentBookings = [];
let currentMenus = [];

// =============================================
// DOM ELEMENTS
// =============================================

const bookingDateInput = document.getElementById("bookingDate");
const menuContainer = document.getElementById("menuContainer");
const bookingTableBody = document.getElementById("bookingTableBody");
const pageMessage = document.getElementById("pageMessage");

// Redirect if student is not logged in.
if (!token) {
    window.location.replace("/login.html");
}

// =============================================
// DATE AND FORMATTING HELPERS
// =============================================

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

function formatMeal(meal) {
    if (!meal) return "—";

    return String(meal).charAt(0).toUpperCase() +
        String(meal).slice(1).toLowerCase();
}

function formatDate(date) {
    if (!date) return "—";

    const parts = String(date).split("-");

    if (parts.length !== 3) return date;

    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(Number(amount) || 0);
}

function parseFoodItems(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);

            if (Array.isArray(parsed)) {
                return parsed;
            }

            return parsed ? [String(parsed)] : [];
        } catch {
            return value ? [value] : [];
        }
    }

    return [];
}

// Normalize database/API field names.
function normalizeMenu(menu) {
    return {
        ...menu,
        id: menu.id,
        menuDate: menu.menuDate || menu.menu_date,
        mealType: menu.mealType || menu.meal_type,
        foodItems: parseFoodItems(
            menu.foodItems ?? menu.food_items
        ),
        description: menu.description || "",
        deadlineAt: menu.deadlineAt || menu.deadline_at
    };
}

function normalizeBooking(booking) {
    return {
        ...booking,
        id: booking.id ?? booking.booking_id,
        bookingDate:
            booking.bookingDate ||
            booking.booking_date ||
            booking.menu_date,
        mealType: booking.mealType || booking.meal_type,
        foodItems: parseFoodItems(
            booking.foodItems ?? booking.food_items
        ),
        status: String(booking.status || "").toLowerCase()
    };
}

// =============================================
// MESSAGE DISPLAY
// =============================================

function showMessage(message, type = "success") {
    if (!pageMessage) return;

    pageMessage.textContent = message;
    pageMessage.className = `message ${type}`;
    pageMessage.style.display = "block";
}

// =============================================
// API REQUEST HELPER
// =============================================

async function apiRequest(url, options = {}) {
    if (!token) {
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

    if (response.status === 401 || response.status === 403) {
        if (response.status === 401) {
            localStorage.removeItem("messToken");
            localStorage.removeItem("messUser");
            window.location.replace("/login.html");
        }

        throw new Error(data.message || "You are not authorized.");
    }

    if (!response.ok) {
        throw new Error(data.message || "Request failed.");
    }

    return data;
}

// =============================================
// STUDENT DETAILS
// =============================================

function loadStudentDetails() {
    try {
        const user = JSON.parse(
            localStorage.getItem("messUser") || "{}"
        );

        const name = user.name || "Student";

        const studentName = document.getElementById("studentName");
        const welcomeName = document.getElementById("welcomeName");

        if (studentName) {
            studentName.textContent = name;
        }

        if (welcomeName) {
            welcomeName.textContent = name.split(" ")[0];
        }

    } catch (error) {
        console.error("Unable to read student details:", error);
    }
}

// =============================================
// OUTSTANDING BALANCE SECTION
// =============================================

function createBalanceSection() {
    let section = document.getElementById("studentBalanceSection");

    if (section) {
        return section;
    }

    section = document.createElement("section");
    section.id = "studentBalanceSection";
    section.className = "student-balance-section";

    section.innerHTML = `
        <div class="balance-card">
            <div class="balance-header">
                <h2>My Mess Balance</h2>
                <button
                    type="button"
                    id="balanceRefreshBtn"
                    class="refresh-btn">
                    Refresh
                </button>
            </div>

            <h3 id="outstandingAmount">Loading...</h3>

            <p class="balance-note">
                Your outstanding amount is calculated from confirmed
                meal bookings.
            </p>

            <div class="balance-breakdown">
                <div class="balance-item">
                    <span>Breakfast</span>
                    <strong id="breakfastBalance">₹0</strong>
                    <small id="breakfastCount">0 bookings</small>
                </div>

                <div class="balance-item">
                    <span>Lunch</span>
                    <strong id="lunchBalance">₹0</strong>
                    <small id="lunchCount">0 bookings</small>
                </div>

                <div class="balance-item">
                    <span>Dinner</span>
                    <strong id="dinnerBalance">₹0</strong>
                    <small id="dinnerCount">0 bookings</small>
                </div>
            </div>

            <p id="balanceMessage" class="balance-message"></p>
        </div>
    `;

    if (menuContainer && menuContainer.parentElement) {
        menuContainer.parentElement.insertBefore(
            section,
            menuContainer
        );
    } else {
        document.body.appendChild(section);
    }

    document.getElementById("balanceRefreshBtn")
        .addEventListener("click", loadStudentBalance);

    return section;
}

function updateBalanceDisplay(data) {
    const breakdown = data.breakdown || {};

    const outstandingAmount =
        data.outstandingAmount ??
        data.outstanding_amount ??
        0;

    const totalElement = document.getElementById("outstandingAmount");

    if (totalElement) {
        totalElement.textContent = formatCurrency(outstandingAmount);
    }

    meals.forEach(meal => {
        const item = breakdown[meal] || {};

        const count = Number(item.count || 0);
        const amount = Number(
            item.amount ??
            (count * MEAL_RATES[meal])
        );

        const amountElement =
            document.getElementById(`${meal}Balance`);

        const countElement =
            document.getElementById(`${meal}Count`);

        if (amountElement) {
            amountElement.textContent = formatCurrency(amount);
        }

        if (countElement) {
            countElement.textContent =
                `${count} ${count === 1 ? "booking" : "bookings"}`;
        }
    });

    const message = document.getElementById("balanceMessage");

    if (message) {
        message.textContent =
            "Cancelled bookings are excluded from this calculation.";
    }
}

async function loadStudentBalance() {
    createBalanceSection();

    const totalElement = document.getElementById("outstandingAmount");

    if (totalElement) {
        totalElement.textContent = "Loading...";
    }

    try {
        const data = await apiRequest(`${API_BASE}/balance`);

        if (!data.success) {
            throw new Error(
                data.message || "Unable to load mess balance."
            );
        }

        updateBalanceDisplay(data);

    } catch (error) {
        console.error("Student balance error:", error);

        if (totalElement) {
            totalElement.textContent = "Unavailable";
        }

        const message = document.getElementById("balanceMessage");

        if (message) {
            message.textContent = error.message;
        }
    }
}

// =============================================
// MENU DISPLAY
// =============================================

function renderMenus(menus) {
    if (!menuContainer) return;

    if (!menus.length) {
        menuContainer.innerHTML = `
            <div class="menu-card">
                <p class="empty">
                    No published menus are available for this date.
                </p>
            </div>
        `;

        return;
    }

    const menuByMeal = {};

    menus.forEach(menu => {
        menuByMeal[menu.mealType] = menu;
    });

    menuContainer.innerHTML = meals.map(meal => {
        const menu = menuByMeal[meal];

        if (!menu) {
            return `
                <article class="menu-card">
                    <h3>${formatMeal(meal)}</h3>
                    <p class="empty">Menu not published yet.</p>
                </article>
            `;
        }

        const foodItems = menu.foodItems || [];

        const foodHTML = foodItems.length
            ? foodItems.map(item =>
                `<li>${escapeHTML(item)}</li>`
            ).join("")
            : "<li>Food items not specified.</li>";

        const deadline = menu.deadlineAt
            ? new Date(menu.deadlineAt)
            : null;

        const deadlineText =
            deadline && !Number.isNaN(deadline.getTime())
                ? deadline.toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Kolkata"
                })
                : "Not configured";

        const existing = currentBookings.find(booking =>
            booking.bookingDate === bookingDateInput.value &&
            booking.mealType === meal &&
            booking.status === "booked"
        );

        const isPastDate =
            bookingDateInput.value < getTodayDate();

        const isDeadlinePassed = deadline
            ? Date.now() > deadline.getTime()
            : false;

        let actionHTML = "";

        if (existing) {
            actionHTML = `
                <p class="booked-label">✓ Already booked</p>

                <button
                    class="cancel-btn"
                    data-booking-id="${escapeHTML(existing.id)}"
                    ${isDeadlinePassed ? "disabled" : ""}>
                    Cancel Booking
                </button>
            `;
        } else {
            const disabled =
                isPastDate || !deadline || isDeadlinePassed;

            actionHTML = `
                <button
                    class="book-btn"
                    data-meal="${meal}"
                    ${disabled ? "disabled" : ""}>
                    ${!deadline
                        ? "Deadline not configured"
                        : isDeadlinePassed
                            ? "Deadline passed"
                            : isPastDate
                                ? "Past date"
                                : "Book Meal"}
                </button>
            `;
        }

        return `
            <article class="menu-card">
                <h3>${formatMeal(meal)}</h3>

                <p class="meal-description">
                    ${escapeHTML(
                        menu.description || "Today's mess menu"
                    )}
                </p>

                <ul class="food-list">${foodHTML}</ul>

                <p class="deadline">
                    <strong>Booking deadline:</strong>
                    ${escapeHTML(deadlineText)}
                </p>

                <p class="meal-rate">
                    <strong>Meal rate:</strong>
                    ${formatCurrency(MEAL_RATES[meal])}
                </p>

                ${actionHTML}
            </article>
        `;
    }).join("");
}

async function loadMenus() {
    if (!bookingDateInput || !menuContainer) return;

    const date = bookingDateInput.value;

    if (!date) return;

    menuContainer.innerHTML = `
        <div class="loading">Loading published menus...</div>
    `;

    try {
        const data = await apiRequest(
            `${API_BASE}/menus?date=${encodeURIComponent(date)}`
        );

        if (!data.success) {
            throw new Error(data.message || "Could not load menus.");
        }

        currentMenus = (data.menus || []).map(normalizeMenu);

        renderMenus(currentMenus);

    } catch (error) {
        menuContainer.innerHTML = `
            <div class="menu-card">
                <p class="empty">${escapeHTML(error.message)}</p>
            </div>
        `;

        showMessage(error.message, "error");
    }
}

// =============================================
// BOOKING HISTORY
// =============================================

function renderBookings(bookings) {
    if (!bookingTableBody) return;

    if (!bookings.length) {
        bookingTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty">
                    You have not made any bookings yet.
                </td>
            </tr>
        `;

        return;
    }

    bookingTableBody.innerHTML = bookings.map(booking => {
        const status = booking.status;

        const foodItems = booking.foodItems.length
            ? booking.foodItems.join(", ")
            : "—";

        const statusClass = status === "booked"
            ? "status-booked"
            : "status-cancelled";

        const dateIsFuture =
            booking.bookingDate >= getTodayDate();

        const action =
            status === "booked" && dateIsFuture
                ? `
                    <button
                        class="cancel-btn"
                        data-booking-id="${escapeHTML(booking.id)}">
                        Cancel
                    </button>
                `
                : "—";

        return `
            <tr>
                <td>${escapeHTML(formatDate(booking.bookingDate))}</td>
                <td>${escapeHTML(formatMeal(booking.mealType))}</td>
                <td>${escapeHTML(foodItems)}</td>
                <td class="${statusClass}">
                    ${escapeHTML(status)}
                </td>
                <td>${action}</td>
            </tr>
        `;
    }).join("");
}

async function loadBookings() {
    if (!bookingTableBody) return;

    bookingTableBody.innerHTML = `
        <tr>
            <td colspan="5" class="empty">Loading bookings...</td>
        </tr>
    `;

    try {
        const data = await apiRequest(`${API_BASE}/bookings`);

        currentBookings = (data.bookings || []).map(normalizeBooking);

        const upcoming = currentBookings.filter(booking =>
            booking.status === "booked" &&
            booking.bookingDate >= getTodayDate()
        );

        const cancelled = currentBookings.filter(booking =>
            booking.status === "cancelled"
        );

        const upcomingElement = document.getElementById("upcomingCount");
        const cancelledElement = document.getElementById("cancelledCount");
        const totalElement = document.getElementById("totalCount");

        if (upcomingElement) {
            upcomingElement.textContent = upcoming.length;
        }

        if (cancelledElement) {
            cancelledElement.textContent = cancelled.length;
        }

        if (totalElement) {
            totalElement.textContent = currentBookings.length;
        }

        renderBookings(currentBookings);

    } catch (error) {
        bookingTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;

        showMessage(error.message, "error");
    }
}

// =============================================
// REFRESH DASHBOARD
// =============================================

async function refreshDashboard() {
    await loadBookings();
    await loadMenus();
    await loadStudentBalance();
}

// =============================================
// BOOK A MEAL
// =============================================

async function bookMeal(mealType) {
    const bookingDate = bookingDateInput.value;

    if (!bookingDate) {
        showMessage("Please select a booking date.", "error");
        return;
    }

    try {
        const data = await apiRequest(`${API_BASE}/bookings`, {
            method: "POST",
            body: JSON.stringify({
                bookingDate,
                mealType
            })
        });

        showMessage(data.message || "Meal booked successfully.");

        await refreshDashboard();

    } catch (error) {
        showMessage(error.message, "error");
    }
}

// =============================================
// CANCEL A MEAL BOOKING
// =============================================

async function cancelBooking(bookingId) {
    if (!confirm("Are you sure you want to cancel this meal booking?")) {
        return;
    }

    try {
        const data = await apiRequest(
            `${API_BASE}/bookings/${encodeURIComponent(bookingId)}`,
            {
                method: "DELETE"
            }
        );

        showMessage(
            data.message || "Booking cancelled successfully."
        );

        await refreshDashboard();

    } catch (error) {
        showMessage(error.message, "error");
    }
}

// =============================================
// EVENT LISTENERS
// =============================================

// Event delegation for booking and cancellation buttons.
document.addEventListener("click", event => {
    const bookButton = event.target.closest(".book-btn");

    if (bookButton && !bookButton.disabled) {
        bookMeal(bookButton.dataset.meal);
        return;
    }

    const cancelButton = event.target.closest(".cancel-btn");

    if (cancelButton && !cancelButton.disabled) {
        cancelBooking(cancelButton.dataset.bookingId);
    }
});

if (bookingDateInput) {
    bookingDateInput.addEventListener("change", loadMenus);
}

const refreshButton = document.getElementById("refreshBtn");

if (refreshButton) {
    refreshButton.addEventListener("click", loadMenus);
}

const historyRefreshButton =
    document.getElementById("historyRefreshBtn");

if (historyRefreshButton) {
    historyRefreshButton.addEventListener("click", loadBookings);
}

const logoutButton = document.getElementById("logoutBtn");

if (logoutButton) {
    logoutButton.addEventListener("click", () => {
        localStorage.removeItem("messToken");
        localStorage.removeItem("messUser");

        window.location.replace("/login.html");
    });
}

// =============================================
// INITIALIZE STUDENT DASHBOARD
// =============================================

if (bookingDateInput) {
    bookingDateInput.value = getTodayDate();
}

loadStudentDetails();
refreshDashboard();
