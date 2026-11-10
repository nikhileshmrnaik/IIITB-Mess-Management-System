
const db = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Generate authentication token
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );
};

// Remove password before sending user data
const safeUser = (user) => {
    const { password, ...userData } = user;
    return userData;
};

// STUDENT REGISTRATION
const register = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            student_id,
            department,
            hostel,
            room_number
        } = req.body;

        if (!name || !email || !password || !student_id) {
            return res.status(400).json({
                success: false,
                message: "Name, email, password and student ID are required."
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanStudentId = student_id.trim();

        if (cleanName.length < 2) {
            return res.status(400).json({
                success: false,
                message: "Name must contain at least 2 characters."
            });
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(cleanEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        const existingUser = db.prepare(`
            SELECT id FROM users
            WHERE email = ? COLLATE NOCASE
               OR student_id = ?
        `).get(cleanEmail, cleanStudentId);

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email or student ID is already registered."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // Public registration always creates a student.
        const result = db.prepare(`
            INSERT INTO users (
                name,
                email,
                password,
                role,
                student_id,
                department,
                hostel,
                room_number
            )
            VALUES (?, ?, ?, 'student', ?, ?, ?, ?)
        `).run(
            cleanName,
            cleanEmail,
            hashedPassword,
            cleanStudentId,
            department?.trim() || null,
            hostel?.trim() || null,
            room_number?.trim() || null
        );

        const user = db.prepare(`
            SELECT * FROM users WHERE id = ?
        `).get(result.lastInsertRowid);

        const token = generateToken(user);

        return res.status(201).json({
            success: true,
            message: "Student registration successful.",
            token,
            user: safeUser(user)
        });

    } catch (error) {
        console.error("Registration error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to complete registration."
        });
    }
};

// USER LOGIN
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const user = db.prepare(`
            SELECT * FROM users
            WHERE email = ? COLLATE NOCASE
        `).get(cleanEmail);

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive. Contact the administrator."
            });
        }

        const token = generateToken(user);

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            token,
            user: safeUser(user)
        });

    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to complete login."
        });
    }
};

// GET LOGGED-IN USER PROFILE
const getMe = (req, res) => {
    return res.status(200).json({
        success: true,
        user: req.user
    });
};

module.exports = {
    register,
    login,
    getMe
};
