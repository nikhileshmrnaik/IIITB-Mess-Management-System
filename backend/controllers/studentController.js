
"use strict";

const db = require("../config/database");

// =============================================
// CONFIGURATION
// =============================================

const ALLOWED_MEALS = ["breakfast", "lunch", "dinner"];

const MEAL_RATES = {
    breakfast: 30,
    lunch: 60,
    dinner: 50
};

// =============================================
// HELPER FUNCTIONS
// =============================================

// Validate YYYY-MM-DD without timezone conversion.
function isValidDate(date) {
    if (typeof date !== "string") {
        return false;
    }

    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) {
        return false;
    }

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

function isValidMeal(mealType) {
    return ALLOWED_MEALS.includes(
        String(mealType || "").toLowerCase()
    );
}

function parseFoodItems(value) {
    if (!value) return [];

    if (Array.isArray(value)) return value;

    try {
        const parsed = JSON.parse(value);

        return Array.isArray(parsed)
            ? parsed
            : [String(parsed)];
    } catch {
        return [String(value)];
    }
}

function getBookingDeadline(bookingDate, mealType) {
    return db.prepare(`
        SELECT deadline_at
        FROM meal_booking_deadlines
        WHERE booking_date = ?
          AND meal_type = ?
    `).get(bookingDate, mealType);
}

function isDeadlinePassed(deadline) {
    if (!deadline) return false;

    const deadlineTime = new Date(
        deadline.deadline_at
    ).getTime();

    if (Number.isNaN(deadlineTime)) {
        throw new Error(
            "Invalid booking deadline stored in database."
        );
    }

    return Date.now() > deadlineTime;
}

// =============================================
// 1. GET PUBLISHED MENUS
// GET /api/student/menus
// =============================================

const getPublishedMenus = (req, res) => {
    try {
        const { date } = req.query;

        let menus;

        if (date) {
            if (!isValidDate(date)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid menu date.",
                    receivedDate: date
                });
            }

            menus = db.prepare(`
                SELECT
                    m.id,
                    m.menu_date,
                    m.meal_type,
                    m.food_items,
                    m.description,
                    m.is_published,
                    d.deadline_at
                FROM menus m
                LEFT JOIN meal_booking_deadlines d
                    ON d.booking_date = m.menu_date
                    AND d.meal_type = m.meal_type
                WHERE m.menu_date = ?
                  AND m.is_published = 1
                ORDER BY
                    CASE m.meal_type
                        WHEN 'breakfast' THEN 1
                        WHEN 'lunch' THEN 2
                        WHEN 'dinner' THEN 3
                    END
            `).all(date);

        } else {
            menus = db.prepare(`
                SELECT
                    m.id,
                    m.menu_date,
                    m.meal_type,
                    m.food_items,
                    m.description,
                    m.is_published,
                    d.deadline_at
                FROM menus m
                LEFT JOIN meal_booking_deadlines d
                    ON d.booking_date = m.menu_date
                    AND d.meal_type = m.meal_type
                WHERE m.is_published = 1
                ORDER BY
                    m.menu_date DESC,
                    CASE m.meal_type
                        WHEN 'breakfast' THEN 1
                        WHEN 'lunch' THEN 2
                        WHEN 'dinner' THEN 3
                    END
            `).all();
        }

        const formattedMenus = menus.map(menu => ({
            ...menu,
            menuDate: menu.menu_date,
            mealType: menu.meal_type,
            foodItems: parseFoodItems(menu.food_items),
            deadlineAt: menu.deadline_at
        }));

        return res.status(200).json({
            success: true,
            menus: formattedMenus
        });

    } catch (error) {
        console.error("Get published menus error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch published menus."
        });
    }
};


// =============================================
// 2. BOOK A MEAL
// POST /api/student/bookings
// =============================================

const bookMeal = (req, res) => {
    try {
        const studentId = req.user.id;

        const bookingDate = req.body.bookingDate;
        const mealType = String(
            req.body.mealType || ""
        ).toLowerCase();

        if (!isValidDate(bookingDate)) {
            return res.status(400).json({
                success: false,
                message: "A valid booking date is required."
            });
        }

        if (!isValidMeal(mealType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid meal type."
            });
        }

        // Check for a published menu.
        const menu = db.prepare(`
            SELECT id
            FROM menus
            WHERE menu_date = ?
              AND meal_type = ?
              AND is_published = 1
        `).get(bookingDate, mealType);

        if (!menu) {
            return res.status(404).json({
                success: false,
                message: "No published menu exists for this meal and date."
            });
        }

        // Check booking deadline.
        const deadline = getBookingDeadline(
            bookingDate,
            mealType
        );

        if (!deadline) {
            return res.status(400).json({
                success: false,
                message: "Booking deadline has not been configured."
            });
        }

        if (isDeadlinePassed(deadline)) {
            return res.status(400).json({
                success: false,
                message: "The booking deadline for this meal has passed."
            });
        }

        // Check for an existing booking.
        const existingBooking = db.prepare(`
            SELECT id, status
            FROM meal_bookings
            WHERE student_id = ?
              AND booking_date = ?
              AND meal_type = ?
        `).get(studentId, bookingDate, mealType);

        if (existingBooking) {
            if (existingBooking.status === "booked") {
                return res.status(409).json({
                    success: false,
                    message: "You have already booked this meal."
                });
            }

            // Restore a cancelled booking.
            db.prepare(`
                UPDATE meal_bookings
                SET status = 'booked',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND student_id = ?
            `).run(existingBooking.id, studentId);

            return res.status(200).json({
                success: true,
                message: "Meal booking restored successfully.",
                bookingId: existingBooking.id
            });
        }

        const result = db.prepare(`
            INSERT INTO meal_bookings (
                student_id,
                booking_date,
                meal_type,
                status,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, 'booked', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(studentId, bookingDate, mealType);

        return res.status(201).json({
            success: true,
            message: "Meal booked successfully.",
            bookingId: result.lastInsertRowid
        });

    } catch (error) {
        console.error("Book meal error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to book meal."
        });
    }
};


// =============================================
// 3. CANCEL A MEAL BOOKING
// DELETE /api/student/bookings/:id
// =============================================

const cancelMealBooking = (req, res) => {
    try {
        const studentId = req.user.id;
        const bookingId = req.params.id;

        const booking = db.prepare(`
            SELECT
                id,
                booking_date,
                meal_type,
                status
            FROM meal_bookings
            WHERE id = ?
              AND student_id = ?
        `).get(bookingId, studentId);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        if (booking.status !== "booked") {
            return res.status(400).json({
                success: false,
                message: "This booking is already cancelled."
            });
        }

        const deadline = getBookingDeadline(
            booking.booking_date,
            booking.meal_type
        );

        if (!deadline) {
            return res.status(400).json({
                success: false,
                message: "Cancellation deadline is not configured."
            });
        }

        if (isDeadlinePassed(deadline)) {
            return res.status(400).json({
                success: false,
                message: "The cancellation deadline for this meal has passed."
            });
        }

        db.prepare(`
            UPDATE meal_bookings
            SET status = 'cancelled',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND student_id = ?
        `).run(bookingId, studentId);

        return res.status(200).json({
            success: true,
            message: "Meal booking cancelled successfully."
        });

    } catch (error) {
        console.error("Cancel meal error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to cancel meal booking."
        });
    }
};


// =============================================
// 4. GET STUDENT BOOKINGS
// GET /api/student/bookings
// =============================================

const getMyBookings = (req, res) => {
    try {
        const studentId = req.user.id;

        const bookings = db.prepare(`
            SELECT
                mb.id,
                mb.student_id,
                mb.booking_date,
                mb.meal_type,
                mb.status,
                mb.created_at,
                mb.updated_at,
                m.food_items
            FROM meal_bookings mb
            LEFT JOIN menus m
                ON m.menu_date = mb.booking_date
                AND m.meal_type = mb.meal_type
            WHERE mb.student_id = ?
            ORDER BY
                mb.booking_date DESC,
                CASE mb.meal_type
                    WHEN 'breakfast' THEN 1
                    WHEN 'lunch' THEN 2
                    WHEN 'dinner' THEN 3
                END
        `).all(studentId);

        const formattedBookings = bookings.map(booking => ({
            ...booking,
            bookingDate: booking.booking_date,
            mealType: booking.meal_type,
            foodItems: parseFoodItems(booking.food_items)
        }));

        return res.status(200).json({
            success: true,
            bookings: formattedBookings
        });

    } catch (error) {
        console.error("Get student bookings error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch student bookings."
        });
    }
};


// =============================================
// 5. GET STUDENT OUTSTANDING MESS BALANCE
// GET /api/student/balance
// =============================================

const getMyBalance = (req, res) => {
    try {
        const studentId = req.user.id;

        const bookingCounts = db.prepare(`
            SELECT
                meal_type,
                COUNT(*) AS total
            FROM meal_bookings
            WHERE student_id = ?
              AND status = 'booked'
            GROUP BY meal_type
        `).all(studentId);

        const counts = {
            breakfast: 0,
            lunch: 0,
            dinner: 0
        };

        bookingCounts.forEach(item => {
            if (
                Object.prototype.hasOwnProperty.call(
                    counts,
                    item.meal_type
                )
            ) {
                counts[item.meal_type] = item.total;
            }
        });

        const breakdown = {
            breakfast: {
                count: counts.breakfast,
                rate: MEAL_RATES.breakfast,
                amount: counts.breakfast * MEAL_RATES.breakfast
            },
            lunch: {
                count: counts.lunch,
                rate: MEAL_RATES.lunch,
                amount: counts.lunch * MEAL_RATES.lunch
            },
            dinner: {
                count: counts.dinner,
                rate: MEAL_RATES.dinner,
                amount: counts.dinner * MEAL_RATES.dinner
            }
        };

        const outstandingAmount =
            breakdown.breakfast.amount +
            breakdown.lunch.amount +
            breakdown.dinner.amount;

        return res.status(200).json({
            success: true,
            currency: "INR",
            breakdown,
            outstandingAmount
        });

    } catch (error) {
        console.error("Student balance error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to calculate outstanding balance."
        });
    }
};


// =============================================
// EXPORT ALL FUNCTIONS
// =============================================

module.exports = {
    getPublishedMenus,
    bookMeal,
    cancelMealBooking,
    getMyBookings,
    getMyBalance
};
