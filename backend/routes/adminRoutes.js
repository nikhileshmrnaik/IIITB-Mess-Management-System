
"use strict";

const express = require("express");
const router = express.Router();

// =============================================
// ADMIN CONTROLLERS
// =============================================

const {
    getDashboardStats,
    getAllMenus,
    createMenu,
    updateMenu,
    deleteMenu,
    setMealBookingDeadline,
    getMealBookingDeadlines,
    getAdminBookings,
    getAllStudentBalances
} = require("../controllers/adminController");

// =============================================
// AUTHENTICATION MIDDLEWARE
// =============================================

const {
    protect,
    authorizeRoles
} = require("../middleware/authMiddleware");

// All admin routes require valid admin login.
router.use(protect, authorizeRoles("admin"));


// =============================================
// 1. ADMIN DASHBOARD
// =============================================

// GET /api/admin/stats
router.get("/stats", getDashboardStats);


// =============================================
// 2. MENU MANAGEMENT
// =============================================

// GET /api/admin/menus
router.get("/menus", getAllMenus);

// POST /api/admin/menus
router.post("/menus", createMenu);

// PUT /api/admin/menus/:id
router.put("/menus/:id", updateMenu);

// DELETE /api/admin/menus/:id
router.delete("/menus/:id", deleteMenu);


// =============================================
// 3. MEAL BOOKING DEADLINE MANAGEMENT
// =============================================

// GET /api/admin/deadlines
router.get("/deadlines", getMealBookingDeadlines);

// POST /api/admin/deadlines
router.post("/deadlines", setMealBookingDeadline);


// =============================================
// 4. ADMIN BOOKING OVERVIEW
// =============================================

// GET /api/admin/bookings
router.get("/bookings", getAdminBookings);


// =============================================
// 5. STUDENT OUTSTANDING BALANCES
// =============================================

// GET /api/admin/balances
router.get("/balances", getAllStudentBalances);


module.exports = router;
