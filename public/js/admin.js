
"use strict";

// =============================================
// IIITB MESS MANAGEMENT SYSTEM
// ADMIN DASHBOARD JAVASCRIPT
// =============================================


// =============================================
// 1. FETCH DASHBOARD STATISTICS
// =============================================

async function fetchDashboardStats(token) {
    try {
        const response = await fetch("/api/admin/stats", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            },
            cache: "no-store"
        });

        const result = await response.json();

        if (!response.ok || !result.success || !result.stats) {
            throw new Error(
                result.message || "Unable to fetch dashboard statistics."
            );
        }

        const stats = result.stats;

        const elements = {
            totalStudents: stats.totalStudents,
            breakfastBookings: stats.breakfastBookings,
            lunchBookings: stats.lunchBookings,
            dinnerBookings: stats.dinnerBookings
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);

            if (element) {
                element.textContent = value ?? 0;
            }
        });

        console.log("Dashboard statistics loaded:", stats);

    } catch (error) {
        console.error("Dashboard statistics error:", error);

        [
            "totalStudents",
            "breakfastBookings",
            "lunchBookings",
            "dinnerBookings"
        ].forEach(id => {
            const element = document.getElementById(id);

            if (element) {
                element.textContent = "N/A";
            }
        });
    }
}


// =============================================
// 2. CREATE STUDENT BALANCE SECTION
// =============================================

function createBalanceSection() {

    let section = document.getElementById("studentBalancesSection");

    if (section) {
        return section;
    }

    section = document.createElement("section");

    section.id = "studentBalancesSection";
    section.className = "content-card";
    section.style.marginTop = "25px";
    section.style.padding = "24px";

    section.innerHTML = `
        <div class="card-header">
            <div>
                <h3>Student Outstanding Balances</h3>
                <p>
                    Meal booking charges for all registered students
                </p>
            </div>

            <button
                type="button"
                id="refreshBalancesBtn"
                style="padding:8px 14px; cursor:pointer;">
                Refresh
            </button>
        </div>

        <div id="balanceSummary" style="margin:20px 0;">
            Loading outstanding balances...
        </div>

        <div style="overflow-x:auto;">
            <table style="
                width:100%;
                min-width:750px;
                border-collapse:collapse;
            ">
                <thead>
                    <tr>
                        <th style="text-align:left;padding:12px;">Student</th>
                        <th style="text-align:left;padding:12px;">Student ID</th>
                        <th style="text-align:center;padding:12px;">Breakfast</th>
                        <th style="text-align:center;padding:12px;">Lunch</th>
                        <th style="text-align:center;padding:12px;">Dinner</th>
                        <th style="text-align:right;padding:12px;">Outstanding</th>
                    </tr>
                </thead>

                <tbody id="balanceTableBody">
                    <tr>
                        <td colspan="6" style="padding:15px;">
                            Loading...
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <p style="margin-top:15px;color:#666;font-size:13px;">
            Rates: Breakfast ₹30 | Lunch ₹60 | Dinner ₹50.
            Charges are calculated from confirmed meal bookings.
        </p>
    `;

    const statsSection = document.querySelector(".stats-grid");

    if (statsSection) {
        statsSection.insertAdjacentElement("afterend", section);
    } else {
        document.querySelector(".main-content")?.appendChild(section);
    }

    return section;
}


// =============================================
// 3. FETCH STUDENT OUTSTANDING BALANCES
// =============================================

async function fetchStudentBalances(token) {

    createBalanceSection();

    const summaryElement =
        document.getElementById("balanceSummary");

    const tableBody =
        document.getElementById("balanceTableBody");

    try {

        const response = await fetch("/api/admin/balances", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            },
            cache: "no-store"
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Unable to fetch student balances."
            );
        }

        const balances = result.balances || [];
        const summary = result.summary || {};

        // Overall summary

        const totalStudents =
            summary.totalStudents ?? balances.length;

        const totalBookings =
            summary.totalBookings ?? 0;

        const totalOutstanding =
            Number(summary.totalOutstandingAmount ?? 0);

        summaryElement.textContent =
            `Total Students: ${totalStudents} | ` +
            `Total Bookings: ${totalBookings} | ` +
            `Total Outstanding: ₹${totalOutstanding.toFixed(2)}`;

        // Clear previous rows

        tableBody.replaceChildren();

        if (balances.length === 0) {

            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 6;
            cell.textContent = "No student records found.";
            cell.style.padding = "15px";

            row.appendChild(cell);
            tableBody.appendChild(row);

            return;
        }

        // Display individual student balances

        balances.forEach(student => {

            const row = document.createElement("tr");

            // Actual API structure:
            // student.breakfast.count
            // student.lunch.count
            // student.dinner.count

            const breakfastCount =
                Number(student.breakfast?.count ?? 0);

            const lunchCount =
                Number(student.lunch?.count ?? 0);

            const dinnerCount =
                Number(student.dinner?.count ?? 0);

            const outstandingAmount =
                Number(student.outstandingAmount ?? 0);

            const values = [
                student.name || "N/A",
                student.studentId || student.student_id || "N/A",
                breakfastCount,
                lunchCount,
                dinnerCount,
                `₹${outstandingAmount.toFixed(2)}`
            ];

            values.forEach((value, index) => {

                const cell = document.createElement("td");

                cell.textContent = value;
                cell.style.padding = "12px";
                cell.style.borderTop = "1px solid #eee";

                if (index >= 2 && index <= 4) {
                    cell.style.textAlign = "center";
                }

                if (index === 5) {
                    cell.style.textAlign = "right";
                    cell.style.fontWeight = "bold";
                }

                row.appendChild(cell);
            });

            tableBody.appendChild(row);
        });

        console.log("Student balances loaded:", result);

    } catch (error) {

        console.error("Student balance error:", error);

        summaryElement.textContent =
            "Unable to load outstanding balances.";

        tableBody.replaceChildren();

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.textContent = error.message;
        cell.style.padding = "15px";

        row.appendChild(cell);
        tableBody.appendChild(row);
    }
}


// =============================================
// 4. ADMIN DASHBOARD INITIALIZATION
// =============================================

document.addEventListener("DOMContentLoaded", async () => {

    const token = localStorage.getItem("messToken");

    // Check login

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    try {

        // Verify authentication

        const response = await fetch("/api/auth/me", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            },
            cache: "no-store"
        });

        const result = await response.json();

        if (!response.ok) {

            localStorage.removeItem("messToken");
            localStorage.removeItem("messUser");

            window.location.href = "/login.html";
            return;
        }

        // Verify admin role

        if (!result.user || result.user.role !== "admin") {

            alert("Access denied. Administrator account required.");

            window.location.href = "/student/dashboard.html";
            return;
        }

        // Display admin name

        const adminNameElement =
            document.getElementById("adminName");

        if (adminNameElement) {
            adminNameElement.textContent =
                result.user.name || "Administrator";
        }

        // Display current date

        const currentDateElement =
            document.getElementById("currentDate");

        if (currentDateElement) {

            currentDateElement.textContent =
                new Date().toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                });
        }

        // Load dashboard data together

        await Promise.all([
            fetchDashboardStats(token),
            fetchStudentBalances(token)
        ]);

        // Manual refresh button

        const refreshButton =
            document.getElementById("refreshBalancesBtn");

        if (refreshButton) {

            refreshButton.addEventListener("click", async () => {

                refreshButton.disabled = true;
                refreshButton.textContent = "Refreshing...";

                await fetchStudentBalances(token);

                refreshButton.disabled = false;
                refreshButton.textContent = "Refresh";
            });
        }

        // Refresh balances when returning to this dashboard tab

        document.addEventListener("visibilitychange", async () => {

            if (!document.hidden) {
                await fetchStudentBalances(token);
            }
        });

        // Refresh balances when browser window regains focus

        window.addEventListener("focus", async () => {
            await fetchStudentBalances(token);
        });

    } catch (error) {

        console.error("Admin authentication error:", error);

        alert("Unable to connect to the server.");
    }


    // =========================================
    // 5. LOGOUT FUNCTIONALITY
    // =========================================

    const logoutBtn =
        document.getElementById("logoutBtn");

    if (logoutBtn) {

        logoutBtn.addEventListener("click", event => {

            event.preventDefault();

            localStorage.removeItem("messToken");
            localStorage.removeItem("messUser");

            window.location.href = "/login.html";
        });
    }

});
