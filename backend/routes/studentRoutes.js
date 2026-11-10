
const express = require("express");
const router = express.Router();

const {
    getPublishedMenus,
    bookMeal,
    cancelMealBooking,
    getMyBookings,
    getMyBalance
} = require("../controllers/studentController");

const {
    protect,
    authorizeRoles
} = require("../middleware/authMiddleware");

// =============================================
// STUDENT AUTHENTICATION
// All routes require a valid student login.
// =============================================

router.use(protect, authorizeRoles("student"));

// =============================================
// MENU MANAGEMENT
// =============================================

// Get published menus
// GET /api/student/menus
router.get("/menus", getPublishedMenus);

// =============================================
// MEAL BOOKING
// =============================================

// Get student's booking history
// GET /api/student/bookings
router.get("/bookings", getMyBookings);

// Book a meal
// POST /api/student/bookings
router.post("/bookings", bookMeal);

// Cancel a meal booking
// DELETE /api/student/bookings/:id
router.delete("/bookings/:id", cancelMealBooking);

// =============================================
// STUDENT OUTSTANDING BALANCE
// =============================================

// Get student's outstanding mess balance
// GET /api/student/balance
router.get("/balance", getMyBalance);

module.exports = router;
