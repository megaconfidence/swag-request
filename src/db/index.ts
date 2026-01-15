/**
 * Database initialization and maintenance utilities
 */

/**
 * Initialize database tables and indexes
 */
export async function initializeDatabase(db: D1Database): Promise<void> {
	await db.batch([
		db.prepare(`
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
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS admin_sessions (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				email TEXT NOT NULL,
				otp TEXT NOT NULL,
				session_token TEXT,
				otp_expires_at DATETIME NOT NULL,
				session_expires_at DATETIME,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`),
		db.prepare('CREATE INDEX IF NOT EXISTS idx_swag_requests_email ON swag_requests(email)'),
		db.prepare('CREATE INDEX IF NOT EXISTS idx_swag_requests_status ON swag_requests(status)'),
		db.prepare('CREATE INDEX IF NOT EXISTS idx_swag_requests_expires_at ON swag_requests(expires_at)'),
		db.prepare('CREATE INDEX IF NOT EXISTS idx_admin_sessions_email ON admin_sessions(email)'),
		db.prepare('CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token)'),
	]);
}

/**
 * Clean up expired data (swag requests and admin sessions)
 */
export async function cleanupExpiredData(db: D1Database): Promise<void> {
	const now = new Date().toISOString();
	await db.prepare('DELETE FROM swag_requests WHERE expires_at < ?').bind(now).run();
	await db.prepare(
		'DELETE FROM admin_sessions WHERE (otp_expires_at < ? AND session_token IS NULL) OR (session_expires_at IS NOT NULL AND session_expires_at < ?)'
	).bind(now, now).run();
}
