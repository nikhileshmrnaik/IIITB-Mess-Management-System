
const path = require("path");

// Load environment variables before connecting to the database.
require("dotenv").config({
    path: path.join(__dirname, "../.env")
});

const bcrypt = require("bcryptjs");
const db = require("../config/database");

async function resetAdminPassword() {
    try {
        const adminId = Number(process.env.ADMIN_ID);
        const newPassword = process.env.ADMIN_PASSWORD;

        if (!Number.isInteger(adminId) || adminId <= 0) {
            throw new Error("A valid ADMIN_ID must be set in backend/.env");
        }

        if (!newPassword || newPassword.length < 12) {
            throw new Error(
                "ADMIN_PASSWORD must contain at least 12 characters."
            );
        }

        // Find the existing administrator.
        const admin = db.prepare(`
            SELECT id, email, role
            FROM users
            WHERE id = ?
        `).get(adminId);

        if (!admin || admin.role !== "admin") {
            throw new Error("Verified admin account not found.");
        }

        // Hash the new password.
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update the existing administrator's password.
        const result = db.prepare(`
            UPDATE users
            SET password = ?
            WHERE id = ? AND role = 'admin'
        `).run(hashedPassword, adminId);

        if (result.changes !== 1) {
            throw new Error("Password update was unsuccessful.");
        }

        console.log("Admin password reset successfully.");
        console.log("Admin ID:", admin.id);
        console.log("Admin email:", admin.email);

    } catch (error) {
        console.error("Password reset failed:", error.message);
        process.exitCode = 1;

    } finally {
        db.close();
    }
}

resetAdminPassword();
