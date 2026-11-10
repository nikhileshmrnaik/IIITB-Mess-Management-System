
const jwt = require("jsonwebtoken");
const db = require("../config/database");

// Verify JWT token
const protect = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please log in."
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const user = db.prepare(`
            SELECT
                id,
                name,
                email,
                role,
                student_id,
                department,
                hostel,
                room_number,
                is_active
            FROM users
            WHERE id = ?
        `).get(decoded.id);

        if (!user || !user.is_active) {
            return res.status(401).json({
                success: false,
                message: "User account is unavailable."
            });
        }

        req.user = user;
        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired authentication token."
        });
    }
};

// Restrict access according to user role
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to access this resource."
            });
        }

        next();
    };
};

module.exports = {
    protect,
    authorizeRoles
};
