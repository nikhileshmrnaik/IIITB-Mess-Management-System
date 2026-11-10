
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// ---------------------------------------------
// DATABASE DIRECTORY AND CONNECTION
// ---------------------------------------------

// Use DB_PATH when configured (for deployment).
// Otherwise, use the existing local SQLite database.
const databasePath = process.env.DB_PATH ||
    path.join(__dirname, "../database/mess_management.db");

// Create the directory if it does not exist.
const databaseDirectory = path.dirname(databasePath);

if (!fs.existsSync(databaseDirectory)) {
    fs.mkdirSync(databaseDirectory, { recursive: true });
}

// Connect to SQLite database.
const db = new Database(databasePath);

// SQLite configuration
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

// ---------------------------------------------
// DATABASE TABLE INITIALIZATION
// ---------------------------------------------

db.exec(`

    -- 1. USERS TABLE
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student'
            CHECK(role IN ('student', 'admin')),
        student_id TEXT UNIQUE,
        department TEXT,
        hostel TEXT,
        room_number TEXT,
        is_active INTEGER NOT NULL DEFAULT 1
            CHECK(is_active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );


    -- 2. MENUS TABLE
    CREATE TABLE IF NOT EXISTS menus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        menu_date TEXT NOT NULL,
        meal_type TEXT NOT NULL
            CHECK(meal_type IN ('breakfast', 'lunch', 'dinner')),
        food_items TEXT NOT NULL,
        description TEXT,
        is_published INTEGER NOT NULL DEFAULT 1
            CHECK(is_published IN (0, 1)),
        created_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT,

        UNIQUE(menu_date, meal_type),

        FOREIGN KEY (created_by)
            REFERENCES users(id) ON DELETE SET NULL
    );


    -- 3. MEAL BOOKINGS TABLE
    CREATE TABLE IF NOT EXISTS meal_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        booking_date TEXT NOT NULL,
        meal_type TEXT NOT NULL
            CHECK(meal_type IN ('breakfast', 'lunch', 'dinner')),
        status TEXT NOT NULL DEFAULT 'booked'
            CHECK(status IN ('booked', 'cancelled')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT,

        UNIQUE(student_id, booking_date, meal_type),

        FOREIGN KEY (student_id)
            REFERENCES users(id) ON DELETE CASCADE
    );


    -- 4. ATTENDANCE TABLE
    CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        attendance_date TEXT NOT NULL,
        meal_type TEXT NOT NULL
            CHECK(meal_type IN ('breakfast', 'lunch', 'dinner')),
        status TEXT NOT NULL
            CHECK(status IN ('present', 'absent')),
        marked_by INTEGER,
        marked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(student_id, attendance_date, meal_type),

        FOREIGN KEY (student_id)
            REFERENCES users(id) ON DELETE CASCADE,

        FOREIGN KEY (marked_by)
            REFERENCES users(id) ON DELETE SET NULL
    );


    -- 5. COMPLAINTS TABLE
    CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
            CHECK(status IN ('pending', 'in-progress', 'resolved')),
        admin_response TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT,

        FOREIGN KEY (student_id)
            REFERENCES users(id) ON DELETE CASCADE
    );


    -- 6. FEEDBACK TABLE
    CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        feedback_date TEXT NOT NULL,
        meal_type TEXT NOT NULL
            CHECK(meal_type IN ('breakfast', 'lunch', 'dinner')),
        rating INTEGER NOT NULL
            CHECK(rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (student_id)
            REFERENCES users(id) ON DELETE CASCADE
    );


    -- 7. ANNOUNCEMENTS TABLE
    CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        created_by INTEGER,
        is_published INTEGER NOT NULL DEFAULT 1
            CHECK(is_published IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (created_by)
            REFERENCES users(id) ON DELETE SET NULL
    );


    -- 8. MEAL BOOKING DEADLINES TABLE
    CREATE TABLE IF NOT EXISTS meal_booking_deadlines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_date TEXT NOT NULL,
        meal_type TEXT NOT NULL
            CHECK(meal_type IN ('breakfast', 'lunch', 'dinner')),
        deadline_at TEXT NOT NULL,
        updated_by INTEGER,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(booking_date, meal_type),

        FOREIGN KEY (updated_by)
            REFERENCES users(id) ON DELETE SET NULL
    );


    -- -----------------------------------------
    -- DATABASE INDEXES
    -- -----------------------------------------

    CREATE INDEX IF NOT EXISTS idx_bookings_date_meal
    ON meal_bookings(booking_date, meal_type, status);

    CREATE INDEX IF NOT EXISTS idx_attendance_date_meal
    ON attendance(attendance_date, meal_type);

    CREATE INDEX IF NOT EXISTS idx_complaints_status
    ON complaints(status);

    CREATE INDEX IF NOT EXISTS idx_menus_date
    ON menus(menu_date);

    CREATE INDEX IF NOT EXISTS idx_deadlines_date_meal
    ON meal_booking_deadlines(booking_date, meal_type);

`);

// ---------------------------------------------
// DATABASE CONNECTION CONFIRMATION
// ---------------------------------------------

console.log("====================================");
console.log("IIITB MESS MANAGEMENT SYSTEM");
console.log("====================================");

console.log("SQLite database connected successfully!");
console.log("All eight database tables initialized.");
console.log("Meal booking deadline table initialized.");
console.log("Database location:", databasePath);

module.exports = db;
