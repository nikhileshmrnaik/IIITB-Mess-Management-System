
const bcrypt = require("bcryptjs");
const db = require("../config/database");
require("dotenv").config();

async function createAdmin() {
    try {
        const name = process.env.ADMIN_NAME;
        const email = process.env.ADMIN_EMAIL;
        const password = process.env.ADMIN_PASSWORD;

        if (!name || !email || !password) {
            throw new Error(
                "ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env"
            );
        }

        if (password.length < 12) {
            throw new Error("Admin password must contain at least 12 characters.");
        }

        const cleanEmail = email.trim().toLowerCase();

        const existingUser = db.prepare(`
            SELECT id, role FROM users
            WHERE email = ? COLLATE NOCASE
        `).get(cleanEmail);

        if (existingUser) {
            if (existingUser.role === "admin") {
                console.log("An admin account with this email already exists.");
            } else {
                console.log(
                    "This email already belongs to a student. Use a different admin email."
                );
            }
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const result = db.prepare(`
            INSERT INTO users (name, email, password, role, is_active)
            VALUES (?, ?, ?, 'admin', 1)
        `).run(name.trim(), cleanEmail, hashedPassword);

        console.log("Admin account created successfully.");
        console.log("Admin ID:", result.lastInsertRowid);
        console.log("Admin email:", cleanEmail);

    } catch (error) {
        console.error("Admin creation failed:", error.message);
        process.exitCode = 1;
    } finally {
        db.close();
    }
}

createAdmin();
