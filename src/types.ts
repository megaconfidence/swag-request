/**
 * Type definitions for the Cloudflare Swag Request Application
 */

export interface Env {
	DB: D1Database;
	RESEND_API_KEY: string;
	FROM_EMAIL: string;
	ALLOWED_ORIGINS?: string;
	ASSETS?: Fetcher;
}

export interface SwagRequest {
	id: number;
	name: string;
	email: string;
	phone: string;
	address: string;
	promo_code: string | null;
	status: 'pending' | 'approved' | 'rejected';
	created_at: string;
	expires_at: string;
}

export interface AdminSession {
	id: number;
	email: string;
	otp: string;
	session_token: string | null;
	otp_expires_at: string;
	session_expires_at: string | null;
	created_at: string;
}

export interface SwagRequestInput {
	name: string;
	email: string;
	phone: string;
	address: string;
	promo_code?: string;
}

export interface OTPInput {
	email: string;
}

export interface VerifyOTPInput {
	email: string;
	otp: string;
}
