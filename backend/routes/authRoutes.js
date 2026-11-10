
const express = require("express");

const router = express.Router();

const {
    register,
    login,
    getMe
} = require("../controllers/authController");

const {
    protect
} = require("../middleware/authMiddleware");

// Student registration
router.post("/register", register);

// Student and admin login
router.post("/login", login);

// Get logged-in user profile
router.get("/me", protect, getMe);

// Export the router directly
module.exports = router;

