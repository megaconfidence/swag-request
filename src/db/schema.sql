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
    expires_at DATETIME DEFAULT (datetime('now', '+30 days'))
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

-- Request Analytics Table (for geographic data from CF properties)
CREATE TABLE IF NOT EXISTS request_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    country TEXT,
    country_code TEXT,
    city TEXT,
    continent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES swag_requests(id) ON DELETE CASCADE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_swag_requests_email ON swag_requests(email);
CREATE INDEX IF NOT EXISTS idx_swag_requests_status ON swag_requests(status);
CREATE INDEX IF NOT EXISTS idx_swag_requests_expires_at ON swag_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_email ON admin_sessions(email);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_request_analytics_request_id ON request_analytics(request_id);
CREATE INDEX IF NOT EXISTS idx_request_analytics_country_code ON request_analytics(country_code);
CREATE INDEX IF NOT EXISTS idx_request_analytics_city ON request_analytics(city);
CREATE INDEX IF NOT EXISTS idx_request_analytics_continent ON request_analytics(continent);
