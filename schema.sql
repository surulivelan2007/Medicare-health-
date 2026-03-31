-- ─────────────────────────────────────────────────────────────────
-- MedCare India — MySQL Database Setup
-- Run this once to create the database and user
-- ─────────────────────────────────────────────────────────────────

-- 1. Create the database
CREATE DATABASE IF NOT EXISTS medcare_india CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. (Optional) Create a dedicated DB user — change the password!
-- CREATE USER 'medcare_user'@'localhost' IDENTIFIED BY 'StrongPassword123!';
-- GRANT ALL PRIVILEGES ON medcare_india.* TO 'medcare_user'@'localhost';
-- FLUSH PRIVILEGES;

USE medcare_india;

-- 3. Users table
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120)  NOT NULL,
  email       VARCHAR(255)  NOT NULL UNIQUE,
  phone       VARCHAR(15)   NOT NULL UNIQUE,
  password    VARCHAR(255)  NOT NULL,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4;

-- 4. Reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id             VARCHAR(36)  PRIMARY KEY,
  user_id        INT          NOT NULL,
  medicine_name  VARCHAR(200) NOT NULL,
  when_to_take   VARCHAR(100) NOT NULL,
  time_hhmm      VARCHAR(5)   NOT NULL,        -- e.g. "08:00"
  time_display   VARCHAR(20)  NOT NULL,         -- e.g. "8:00 AM"
  session        VARCHAR(20)  DEFAULT 'morning', -- morning/noon/evening/night
  notify_email   TINYINT(1)   DEFAULT 0,
  notify_sms     TINYINT(1)   DEFAULT 0,
  email          VARCHAR(255),
  phone          VARCHAR(15),
  active         TINYINT(1)   DEFAULT 1,
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4;

-- Done! The server.js will auto-create these on startup too.
SELECT 'MedCare India database ready.' AS status;
