
// ==========================================
// IIITB MESS MANAGEMENT SYSTEM
// ADMIN MENU MANAGEMENT
// ==========================================

const API_URL = "/api/admin/menus";

let menus = [];
let editingMenuId = null;


// ==========================================
// DOM ELEMENTS
// ==========================================

const menuForm = document.getElementById("menuForm");

const menuDate = document.getElementById("menuDate");
const mealType = document.getElementById("mealType");
const foodItems = document.getElementById("foodItems");
const description = document.getElementById("description");
const isPublished = document.getElementById("isPublished");

const menuTableBody = document.getElementById("menuTableBody");
const menuCount = document.getElementById("menuCount");

const saveBtn = document.getElementById("saveBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const formTitle = document.getElementById("formTitle");

const messageBox = document.getElementById("messageBox");

const filterDate = document.getElementById("filterDate");
const filterBtn = document.getElementById("filterBtn");
const clearFilterBtn = document.getElementById("clearFilterBtn");


// ==========================================
// AUTHENTICATION
// ==========================================

function getToken() {
    return localStorage.getItem("messToken");
}


async function apiRequest(url, options = {}) {
    const token = getToken();

    if (!token) {
        throw new Error("Please log in before managing menus.");
    }

    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            "Authorization": `Bearer ${token}`,
            ...(options.body ? {
                "Content-Type": "application/json"
            } : {})
        },
        cache: "no-store"
    });

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok) {
        throw new Error(
            result.message || "Something went wrong."
        );
    }

    return result;
}


// ==========================================
// NORMALIZE MENU DATA
// ==========================================

function normalizeMenu(menu) {
    return {
        ...menu,

        id: menu.id,

        menuDate:
            menu.menuDate ??
            menu.menu_date ??
            "",

        mealType:
            menu.mealType ??
            menu.meal_type ??
            "",

        foodItems: Array.isArray(menu.foodItems)
            ? menu.foodItems
            : Array.isArray(menu.food_items)
                ? menu.food_items
                : [],

        description:
            menu.description ?? "",

        isPublished:
            menu.isPublished === true ||
            menu.isPublished === 1 ||
            menu.isPublished === "1" ||
            menu.is_published === true ||
            menu.is_published === 1 ||
            menu.is_published === "1"
    };
}


// ==========================================
// DATE DISPLAY
// ==========================================

function getLocalDate() {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function displayDate() {
    const today = new Date();
    const todayDateElement = document.getElementById("todayDate");

    if (todayDateElement) {
        todayDateElement.textContent =
            today.toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            });
    }
}


// ==========================================
// MESSAGE DISPLAY
// ==========================================

function showMessage(message, type = "success") {
    if (!messageBox) return;

    messageBox.textContent = message;

    messageBox.className =
        type === "success"
            ? "message-box message-success"
            : "message-box message-error";

    messageBox.hidden = false;

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


function hideMessage() {
    if (messageBox) {
        messageBox.hidden = true;
    }
}


// ==========================================
// SAFE HTML OUTPUT
// ==========================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}


// ==========================================
// LOAD MENUS
// ==========================================

async function loadMenus(date = "") {
    if (!menuTableBody) return;

    menuTableBody.innerHTML = `
        <tr>
            <td colspan="6" class="loading">
                Loading menus...
            </td>
        </tr>
    `;

    try {
        let url = API_URL;

        if (date) {
            url += `?date=${encodeURIComponent(date)}`;
        }

        const result = await apiRequest(url);

        if (!result.success) {
            throw new Error(
                result.message || "Unable to load menus."
            );
        }

        if (!Array.isArray(result.menus)) {
            throw new Error("Invalid menu data received from server.");
        }

        // Convert backend field names into frontend field names.
        menus = result.menus.map(normalizeMenu);

        displayMenus(menus);

    } catch (error) {
        console.error("Load menus error:", error);

        menuTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-row">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;

        if (menuCount) {
            menuCount.textContent = "Unable to load menus.";
        }

        showMessage(error.message, "error");
    }
}


// ==========================================
// DISPLAY MENUS IN TABLE
// ==========================================

function displayMenus(menuList) {
    if (!menuTableBody) return;

    menuTableBody.innerHTML = "";

    if (!Array.isArray(menuList) || menuList.length === 0) {
        menuTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-row">
                    No menus found. Add your first menu above.
                </td>
            </tr>
        `;

        if (menuCount) {
            menuCount.textContent = "Total menus: 0";
        }

        return;
    }

    menuList.forEach(menu => {
        const row = document.createElement("tr");

        const items = menu.foodItems
            .map(item => escapeHTML(item))
            .join(", ");

        const formattedMealType = String(
            menu.mealType ?? ""
        );

        const mealLabel = formattedMealType
            ? formattedMealType.charAt(0).toUpperCase() +
              formattedMealType.slice(1)
            : "Not specified";

        row.innerHTML = `
            <td>${escapeHTML(menu.menuDate)}</td>

            <td>
                ${escapeHTML(mealLabel)}
            </td>

            <td class="food-list">${items}</td>

            <td>${escapeHTML(menu.description || "-")}</td>

            <td>
                <span class="status ${
                    menu.isPublished ? "published" : "unpublished"
                }">
                    ${menu.isPublished ? "Published" : "Unpublished"}
                </span>
            </td>

            <td>
                <div class="action-group">
                    <button
                        class="action-btn edit-btn"
                        data-action="edit"
                        data-id="${escapeHTML(menu.id)}"
                    >
                        Edit
                    </button>

                    <button
                        class="action-btn delete-btn"
                        data-action="delete"
                        data-id="${escapeHTML(menu.id)}"
                    >
                        Delete
                    </button>
                </div>
            </td>
        `;

        menuTableBody.appendChild(row);
    });

    if (menuCount) {
        menuCount.textContent =
            `Total menus: ${menuList.length}`;
    }
}


// ==========================================
// RESET FORM
// ==========================================

function resetForm() {
    if (!menuForm) return;

    menuForm.reset();

    editingMenuId = null;

    if (menuDate) {
        menuDate.value = getLocalDate();
    }

    if (isPublished) {
        isPublished.checked = true;
    }

    if (formTitle) {
        formTitle.textContent = "Add New Menu";
    }

    if (saveBtn) {
        saveBtn.textContent = "Save Menu";
    }

    if (cancelEditBtn) {
        cancelEditBtn.hidden = true;
    }
}


// ==========================================
// ADD OR UPDATE MENU
// ==========================================

if (menuForm) {
    menuForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        hideMessage();

        const items = foodItems.value
            .split(",")
            .map(item => item.trim())
            .filter(item => item.length > 0);

        if (items.length === 0) {
            showMessage(
                "Please enter at least one food item.",
                "error"
            );
            return;
        }

        if (!menuDate.value || !mealType.value) {
            showMessage(
                "Please select a menu date and meal type.",
                "error"
            );
            return;
        }

        const menuData = {
            menuDate: menuDate.value,
            mealType: mealType.value,
            foodItems: items,
            description: description.value.trim(),
            isPublished: isPublished.checked
        };

        const isEditing = editingMenuId !== null;

        const url = isEditing
            ? `${API_URL}/${editingMenuId}`
            : API_URL;

        const method = isEditing ? "PUT" : "POST";

        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";

        try {
            const result = await apiRequest(url, {
                method,
                body: JSON.stringify(menuData)
            });

            showMessage(
                result.message || "Menu saved successfully.",
                "success"
            );

            resetForm();

            await loadMenus(filterDate ? filterDate.value : "");

        } catch (error) {
            console.error("Save menu error:", error);

            showMessage(error.message, "error");

        } finally {
            saveBtn.disabled = false;

            saveBtn.textContent =
                editingMenuId === null
                    ? "Save Menu"
                    : "Update Menu";
        }
    });
}


// ==========================================
// EDIT MENU
// ==========================================

function editMenu(id) {
    const menu = menus.find(
        item => String(item.id) === String(id)
    );

    if (!menu) {
        showMessage("Menu not found.", "error");
        return;
    }

    editingMenuId = menu.id;

    menuDate.value = menu.menuDate;
    mealType.value = menu.mealType;

    foodItems.value = menu.foodItems.join(", ");

    description.value = menu.description || "";

    isPublished.checked = menu.isPublished;

    formTitle.textContent = "Edit Existing Menu";

    saveBtn.textContent = "Update Menu";

    cancelEditBtn.hidden = false;

    menuForm.scrollIntoView({
        behavior: "smooth"
    });
}


// ==========================================
// DELETE MENU
// ==========================================

async function deleteMenu(id) {
    const confirmed = confirm(
        "Are you sure you want to delete this menu?"
    );

    if (!confirmed) {
        return;
    }

    try {
        const result = await apiRequest(
            `${API_URL}/${id}`,
            {
                method: "DELETE"
            }
        );

        showMessage(
            result.message || "Menu deleted successfully.",
            "success"
        );

        if (String(editingMenuId) === String(id)) {
            resetForm();
        }

        await loadMenus(filterDate ? filterDate.value : "");

    } catch (error) {
        console.error("Delete menu error:", error);

        showMessage(error.message, "error");
    }
}


// ==========================================
// TABLE ACTION HANDLING
// ==========================================

if (menuTableBody) {
    menuTableBody.addEventListener("click", (event) => {
        const button = event.target.closest(
            "button[data-action]"
        );

        if (!button) {
            return;
        }

        const id = button.dataset.id;
        const action = button.dataset.action;

        if (action === "edit") {
            editMenu(id);
        }

        if (action === "delete") {
            deleteMenu(id);
        }
    });
}


// ==========================================
// FILTER MENUS BY DATE
// ==========================================

if (filterBtn) {
    filterBtn.addEventListener("click", () => {
        if (!filterDate.value) {
            showMessage(
                "Please select a date to filter menus.",
                "error"
            );
            return;
        }

        hideMessage();
        loadMenus(filterDate.value);
    });
}


// ==========================================
// SHOW ALL MENUS
// ==========================================

if (clearFilterBtn) {
    clearFilterBtn.addEventListener("click", () => {
        if (filterDate) {
            filterDate.value = "";
        }

        hideMessage();
        loadMenus();
    });
}


// ==========================================
// CANCEL EDITING
// ==========================================

if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
        resetForm();
        hideMessage();
    });
}


// ==========================================
// LOGOUT
// ==========================================

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("messToken");
        localStorage.removeItem("messUser");

        window.location.href = "/login.html";
    });
}


// ==========================================
// INITIALIZE MENU MANAGEMENT
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    displayDate();

    if (menuDate) {
        menuDate.value = getLocalDate();
    }

    if (!getToken()) {
        showMessage(
            "You are not logged in. Please log in to manage menus.",
            "error"
        );

        if (menuTableBody) {
            menuTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-row">
                        Login required.
                    </td>
                </tr>
            `;
        }

        return;
    }

    loadMenus();
});
