-- Swag Requests Table
CREATE TABLE IF NOT EXISTS swag_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    promo_code TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME DEFAULT (datetime('now', '+7 days'))
);

-- Admin Sessions Table (for OTP authentication)
CREATE TABLE IF NOT EXISTS admin_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    session_token TEXT,
    otp_expires_at DATETIME NOT NULL,
    session_expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_swag_requests_email ON swag_requests(email);
CREATE INDEX IF NOT EXISTS idx_swag_requests_status ON swag_requests(status);
CREATE INDEX IF NOT EXISTS idx_swag_requests_expires_at ON swag_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_email ON admin_sessions(email);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
