
const express = require("express");
const path = require("path");
require("dotenv").config();

// ---------------------------------------------
// DATABASE CONNECTION
// ---------------------------------------------

const db = require("./config/database");

// ---------------------------------------------
// ROUTE IMPORTS
// ---------------------------------------------

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const studentRoutes = require("./routes/studentRoutes");

// ---------------------------------------------
// EXPRESS APPLICATION
// ---------------------------------------------

const app = express();

// ---------------------------------------------
// JWT CONFIGURATION CHECK
// ---------------------------------------------

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error(
        "Please configure a secure JWT_SECRET in backend/.env"
    );
}

// ---------------------------------------------
// MIDDLEWARE
// ---------------------------------------------

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------
// API ROUTES
// IMPORTANT: Keep these BEFORE the API 404.
// ---------------------------------------------

// Authentication routes
app.use("/api/auth", authRoutes);

// Administrator routes
app.use("/api/admin", adminRoutes);

// Student routes
app.use("/api/student", studentRoutes);

// ---------------------------------------------
// HEALTH CHECK
// ---------------------------------------------

app.get("/api/health", (req, res) => {
    try {
        const result = db.prepare(
            "SELECT 1 AS connected"
        ).get();

        res.status(200).json({
            success: true,
            message: "IIITB Mess Management API is running",
            database: result.connected === 1
                ? "Connected"
                : "Disconnected"
        });

    } catch (error) {
        console.error("Health check error:", error.message);

        res.status(500).json({
            success: false,
            message: "Database connection error"
        });
    }
});

// ---------------------------------------------
// STATIC FRONTEND FILES
// ---------------------------------------------

app.use(express.static(path.join(__dirname, "../public")));

// ---------------------------------------------
// API 404 HANDLER
// Must come AFTER all API routes.
// ---------------------------------------------

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found."
    });
});

// ---------------------------------------------
// SERVER START
// ---------------------------------------------

const PORT = process.env.PORT || 5000;

// Listen on all network interfaces.
// Required for external hosting platforms such as Render.
const server = app.listen(PORT, "0.0.0.0", () => {
    console.log("------------------------------------");
    console.log("IIITB MESS MANAGEMENT SYSTEM");
    console.log("------------------------------------");
    console.log(`Server running on port ${PORT}`);
    console.log("Server listening:", server.listening);
});

// ---------------------------------------------
// SERVER ERROR HANDLING
// ---------------------------------------------

server.on("error", (error) => {
    console.error("EXPRESS SERVER ERROR:", error);
});

server.on("close", () => {
    console.log("WARNING: EXPRESS SERVER CLOSED");
});
