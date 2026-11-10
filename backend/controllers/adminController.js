
"use strict";

const db = require("../config/database");

const ALLOWED_MEALS = ["breakfast", "lunch", "dinner"];

const MEAL_RATES = {
    breakfast: 30,
    lunch: 60,
    dinner: 50
};

// =============================================
// HELPER FUNCTIONS
// =============================================

// Get today's date in Indian Standard Time.
function getToday() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());

    const values = {};

    parts.forEach(part => {
        values[part.type] = part.value;
    });

    return `${values.year}-${values.month}-${values.day}`;
}

// Validate YYYY-MM-DD without timezone conversion.
function isValidDate(date) {
    if (typeof date !== "string") return false;

    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const parsed = new Date(Date.UTC(year, month - 1, day));

    return (
        parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day
    );
}

// Parse stored food items.
function parseFoodItems(value) {
    if (typeof value !== "string" || !value.trim()) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);

        return Array.isArray(parsed)
            ? parsed
            : [String(parsed)];

    } catch {
        return value
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);
    }
}

// Validate ISO timestamp containing timezone.
function isValidDeadline(value) {
    if (typeof value !== "string") return false;

    const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);

    return hasTimezone && !Number.isNaN(Date.parse(value));
}


// =============================================
// 1. ADMIN DASHBOARD STATISTICS
// GET /api/admin/stats
// =============================================

const getDashboardStats = (req, res) => {
    try {
        const today = getToday();

        const students = db.prepare(`
            SELECT COUNT(*) AS total
            FROM users
            WHERE role = 'student'
              AND is_active = 1
        `).get().total;

        const menus = db.prepare(`
            SELECT COUNT(*) AS total
            FROM menus
            WHERE menu_date = ?
        `).get(today).total;

        const mealBookings = db.prepare(`
            SELECT
                meal_type,
                COUNT(*) AS total
            FROM meal_bookings
            WHERE booking_date = ?
              AND status = 'booked'
            GROUP BY meal_type
        `).all(today);

        const bookingCounts = {
            breakfast: 0,
            lunch: 0,
            dinner: 0
        };

        mealBookings.forEach(booking => {
            if (Object.prototype.hasOwnProperty.call(
                bookingCounts,
                booking.meal_type
            )) {
                bookingCounts[booking.meal_type] = booking.total;
            }
        });

        const totalBookings =
            bookingCounts.breakfast +
            bookingCounts.lunch +
            bookingCounts.dinner;

        const complaints = db.prepare(`
            SELECT COUNT(*) AS total
            FROM complaints
            WHERE status IN ('pending', 'in-progress')
        `).get().total;

        return res.json({
            success: true,
            stats: {
                totalStudents: students,
                todayMenus: menus,
                todayBookings: totalBookings,
                breakfastBookings: bookingCounts.breakfast,
                lunchBookings: bookingCounts.lunch,
                dinnerBookings: bookingCounts.dinner,
                pendingComplaints: complaints
            }
        });

    } catch (error) {
        console.error("Dashboard statistics error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve dashboard statistics."
        });
    }
};


// =============================================
// 2. GET ALL MENUS
// GET /api/admin/menus
// =============================================

const getAllMenus = (req, res) => {
    try {
        const date = req.query.date;

        if (date && !isValidDate(date)) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format."
            });
        }

        let menus;

        if (date) {
            menus = db.prepare(`
                SELECT *
                FROM menus
                WHERE menu_date = ?
                ORDER BY
                    CASE meal_type
                        WHEN 'breakfast' THEN 1
                        WHEN 'lunch' THEN 2
                        WHEN 'dinner' THEN 3
                    END
            `).all(date);

        } else {
            menus = db.prepare(`
                SELECT *
                FROM menus
                ORDER BY
                    menu_date DESC,
                    CASE meal_type
                        WHEN 'breakfast' THEN 1
                        WHEN 'lunch' THEN 2
                        WHEN 'dinner' THEN 3
                    END
            `).all();
        }

        return res.json({
            success: true,
            count: menus.length,
            menus: menus.map(menu => ({
                ...menu,
                foodItems: parseFoodItems(menu.food_items),
                food_items: undefined
            }))
        });

    } catch (error) {
        console.error("Get menus error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve menus."
        });
    }
};


// =============================================
// 3. CREATE MENU
// POST /api/admin/menus
// =============================================

const createMenu = (req, res) => {
    try {
        const {
            menuDate,
            mealType,
            foodItems,
            description,
            isPublished
        } = req.body;

        if (!isValidDate(menuDate)) {
            return res.status(400).json({
                success: false,
                message: "A valid menu date is required."
            });
        }

        if (!ALLOWED_MEALS.includes(mealType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid meal type."
            });
        }

        if (
            !Array.isArray(foodItems) ||
            foodItems.length === 0 ||
            foodItems.some(
                item => typeof item !== "string" || !item.trim()
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "At least one valid food item is required."
            });
        }

        const result = db.prepare(`
            INSERT INTO menus (
                menu_date,
                meal_type,
                food_items,
                description,
                is_published,
                created_by
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            menuDate,
            mealType,
            JSON.stringify(foodItems.map(item => item.trim())),
            description || null,
            isPublished === false ? 0 : 1,
            req.user.id
        );

        return res.status(201).json({
            success: true,
            message: "Menu created successfully.",
            menuId: result.lastInsertRowid
        });

    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                success: false,
                message: "A menu already exists for this date and meal."
            });
        }

        console.error("Create menu error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to create menu."
        });
    }
};


// =============================================
// 4. UPDATE MENU
// PUT /api/admin/menus/:id
// =============================================

const updateMenu = (req, res) => {
    try {
        const menuId = Number(req.params.id);

        const {
            menuDate,
            mealType,
            foodItems,
            description,
            isPublished
        } = req.body;

        if (!Number.isSafeInteger(menuId) || menuId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid menu ID."
            });
        }

        if (!isValidDate(menuDate)) {
            return res.status(400).json({
                success: false,
                message: "A valid menu date is required."
            });
        }

        if (!ALLOWED_MEALS.includes(mealType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid meal type."
            });
        }

        if (
            !Array.isArray(foodItems) ||
            foodItems.length === 0 ||
            foodItems.some(
                item => typeof item !== "string" || !item.trim()
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "At least one valid food item is required."
            });
        }

        const result = db.prepare(`
            UPDATE menus
            SET
                menu_date = ?,
                meal_type = ?,
                food_items = ?,
                description = ?,
                is_published = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            menuDate,
            mealType,
            JSON.stringify(foodItems.map(item => item.trim())),
            description || null,
            isPublished === false ? 0 : 1,
            menuId
        );

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "Menu not found."
            });
        }

        return res.json({
            success: true,
            message: "Menu updated successfully."
        });

    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                success: false,
                message: "A menu already exists for this date and meal."
            });
        }

        console.error("Update menu error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update menu."
        });
    }
};


// =============================================
// 5. DELETE MENU
// DELETE /api/admin/menus/:id
// =============================================

const deleteMenu = (req, res) => {
    try {
        const menuId = Number(req.params.id);

        if (!Number.isSafeInteger(menuId) || menuId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid menu ID."
            });
        }

        const result = db.prepare(`
            DELETE FROM menus
            WHERE id = ?
        `).run(menuId);

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "Menu not found."
            });
        }

        return res.json({
            success: true,
            message: "Menu deleted successfully."
        });

    } catch (error) {
        console.error("Delete menu error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to delete menu."
        });
    }
};


// =============================================
// 6. SET OR UPDATE MEAL BOOKING DEADLINE
// POST /api/admin/deadlines
// =============================================

const setMealBookingDeadline = (req, res) => {
    try {
        const {
            bookingDate,
            mealType,
            deadlineAt
        } = req.body;

        if (!isValidDate(bookingDate)) {
            return res.status(400).json({
                success: false,
                message: "A valid booking date is required."
            });
        }

        if (!ALLOWED_MEALS.includes(mealType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid meal type."
            });
        }

        if (!isValidDeadline(deadlineAt)) {
            return res.status(400).json({
                success: false,
                message: "Provide a valid deadline with a timezone."
            });
        }

        db.prepare(`
            INSERT INTO meal_booking_deadlines (
                booking_date,
                meal_type,
                deadline_at,
                updated_by
            )
            VALUES (?, ?, ?, ?)

            ON CONFLICT(booking_date, meal_type)
            DO UPDATE SET
                deadline_at = excluded.deadline_at,
                updated_by = excluded.updated_by,
                updated_at = CURRENT_TIMESTAMP
        `).run(
            bookingDate,
            mealType,
            deadlineAt,
            req.user.id
        );

        return res.json({
            success: true,
            message: "Meal booking deadline saved successfully."
        });

    } catch (error) {
        console.error("Set deadline error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to save booking deadline."
        });
    }
};


// =============================================
// 7. GET MEAL BOOKING DEADLINES
// GET /api/admin/deadlines
// =============================================

const getMealBookingDeadlines = (req, res) => {
    try {
        const date = req.query.date;

        if (date && !isValidDate(date)) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format."
            });
        }

        const deadlines = date
            ? db.prepare(`
                SELECT
                    booking_date AS bookingDate,
                    meal_type AS mealType,
                    deadline_at AS deadlineAt
                FROM meal_booking_deadlines
                WHERE booking_date = ?
                ORDER BY meal_type
            `).all(date)

            : db.prepare(`
                SELECT
                    booking_date AS bookingDate,
                    meal_type AS mealType,
                    deadline_at AS deadlineAt
                FROM meal_booking_deadlines
                ORDER BY booking_date DESC, meal_type
            `).all();

        return res.json({
            success: true,
            deadlines
        });

    } catch (error) {
        console.error("Get deadlines error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve deadlines."
        });
    }
};


// =============================================
// 8. ADMIN BOOKING OVERVIEW
// GET /api/admin/bookings
// =============================================

const getAdminBookings = (req, res) => {
    try {
        const date = req.query.date || getToday();
        const mealType = req.query.mealType;

        if (!isValidDate(date)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking date."
            });
        }

        if (mealType && !ALLOWED_MEALS.includes(mealType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid meal type."
            });
        }

        const summary = db.prepare(`
            SELECT
                meal_type AS mealType,
                COUNT(*) AS totalBookings,

                SUM(
                    CASE
                        WHEN status = 'booked' THEN 1
                        ELSE 0
                    END
                ) AS activeBookings,

                SUM(
                    CASE
                        WHEN status = 'cancelled' THEN 1
                        ELSE 0
                    END
                ) AS cancelledBookings

            FROM meal_bookings
            WHERE booking_date = ?
            GROUP BY meal_type
        `).all(date);

        const bookingQuery = `
            SELECT
                b.id,
                b.booking_date AS bookingDate,
                b.meal_type AS mealType,
                b.status,
                b.created_at AS createdAt,

                u.name AS studentName,
                u.email AS studentEmail,
                u.student_id AS studentNumber,
                u.hostel,
                u.room_number AS roomNumber

            FROM meal_bookings b

            JOIN users u
                ON u.id = b.student_id

            WHERE b.booking_date = ?

            ${mealType ? "AND b.meal_type = ?" : ""}

            ORDER BY b.created_at DESC
        `;

        const bookings = mealType
            ? db.prepare(bookingQuery).all(date, mealType)
            : db.prepare(bookingQuery).all(date);

        return res.json({
            success: true,
            date,
            summary,
            bookings
        });

    } catch (error) {
        console.error("Get admin bookings error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve bookings."
        });
    }
};


// =============================================
// 9. ADMIN OUTSTANDING MESS BALANCES
// GET /api/admin/balances
// =============================================

const getAllStudentBalances = (req, res) => {
    try {
        // Include all active students, including those
        // who have not made any bookings.
        const students = db.prepare(`
            SELECT
                u.id,
                u.name,
                u.student_id,
                u.email,
                u.hostel,
                u.room_number,

                SUM(
                    CASE
                        WHEN b.meal_type = 'breakfast'
                         AND b.status = 'booked'
                        THEN 1 ELSE 0
                    END
                ) AS breakfastCount,

                SUM(
                    CASE
                        WHEN b.meal_type = 'lunch'
                         AND b.status = 'booked'
                        THEN 1 ELSE 0
                    END
                ) AS lunchCount,

                SUM(
                    CASE
                        WHEN b.meal_type = 'dinner'
                         AND b.status = 'booked'
                        THEN 1 ELSE 0
                    END
                ) AS dinnerCount

            FROM users u

            LEFT JOIN meal_bookings b
                ON b.student_id = u.id

            WHERE u.role = 'student'
              AND u.is_active = 1

            GROUP BY
                u.id,
                u.name,
                u.student_id,
                u.email,
                u.hostel,
                u.room_number

            ORDER BY u.name ASC
        `).all();

        const balances = students.map(student => {
            const breakfastCount =
                Number(student.breakfastCount || 0);

            const lunchCount =
                Number(student.lunchCount || 0);

            const dinnerCount =
                Number(student.dinnerCount || 0);

            const breakfastAmount =
                breakfastCount * MEAL_RATES.breakfast;

            const lunchAmount =
                lunchCount * MEAL_RATES.lunch;

            const dinnerAmount =
                dinnerCount * MEAL_RATES.dinner;

            const outstandingAmount =
                breakfastAmount +
                lunchAmount +
                dinnerAmount;

            return {
                id: student.id,
                name: student.name,
                studentId: student.student_id,
                email: student.email,
                hostel: student.hostel,
                roomNumber: student.room_number,

                breakfast: {
                    count: breakfastCount,
                    rate: MEAL_RATES.breakfast,
                    amount: breakfastAmount
                },

                lunch: {
                    count: lunchCount,
                    rate: MEAL_RATES.lunch,
                    amount: lunchAmount
                },

                dinner: {
                    count: dinnerCount,
                    rate: MEAL_RATES.dinner,
                    amount: dinnerAmount
                },

                totalBookings:
                    breakfastCount +
                    lunchCount +
                    dinnerCount,

                outstandingAmount
            };
        });

        const summary = {
            totalStudents: balances.length,

            totalBreakfastBookings: balances.reduce(
                (sum, student) => sum + student.breakfast.count,
                0
            ),

            totalLunchBookings: balances.reduce(
                (sum, student) => sum + student.lunch.count,
                0
            ),

            totalDinnerBookings: balances.reduce(
                (sum, student) => sum + student.dinner.count,
                0
            ),

            totalBookings: balances.reduce(
                (sum, student) => sum + student.totalBookings,
                0
            ),

            totalOutstandingAmount: balances.reduce(
                (sum, student) => sum + student.outstandingAmount,
                0
            )
        };

        return res.status(200).json({
            success: true,
            currency: "INR",
            summary,
            balances
        });

    } catch (error) {
        console.error("Admin student balances error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve student balances."
        });
    }
};


// =============================================
// EXPORT ALL ADMIN CONTROLLERS
// =============================================

module.exports = {
    getDashboardStats,
    getAllMenus,
    createMenu,
    updateMenu,
    deleteMenu,
    setMealBookingDeadline,
    getMealBookingDeadlines,
    getAdminBookings,
    getAllStudentBalances
};
