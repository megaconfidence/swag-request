/**
 * Cryptographic utilities for OTP and session token generation
 */

/**
 * Generate a cryptographically secure 6-digit OTP
 */
export function generateOTP(): string {
	const array = new Uint32Array(1);
	crypto.getRandomValues(array);
	return String(100000 + (array[0] % 900000)).padStart(6, '0');
}

/**
 * Generate a secure session token
 */
export function generateSessionToken(): string {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}
