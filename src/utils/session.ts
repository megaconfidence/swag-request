/**
 * Session management utilities
 */

import type { AdminSession } from '../types';

/**
 * Extract session token from cookie header
 */
export function getSessionToken(request: Request): string | null {
	const cookie = request.headers.get('Cookie');
	if (!cookie) return null;
	const match = cookie.match(/admin_session=([^;]+)/);
	return match ? match[1] : null;
}

/**
 * Validate admin session against database
 */
export async function validateAdminSession(
	db: D1Database,
	sessionToken: string | null
): Promise<boolean> {
	if (!sessionToken) return false;
	const now = new Date().toISOString();
	const session = await db.prepare(
		'SELECT * FROM admin_sessions WHERE session_token = ? AND session_expires_at > ?'
	).bind(sessionToken, now).first<AdminSession>();
	return !!session;
}
