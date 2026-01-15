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

// Analytics types
export interface RequestAnalytics {
	id: number;
	request_id: number;
	country: string | null;
	country_code: string | null;
	city: string | null;
	continent: string | null;
	created_at: string;
}

export interface AnalyticsSummary {
	total: number;
	pending: number;
	approved: number;
	rejected: number;
	approval_rate: number;
}

export interface CountryStats {
	name: string;
	code: string;
	count: number;
}

export interface CityStats {
	name: string;
	country: string;
	count: number;
}

export interface ContinentStats {
	name: string;
	count: number;
}

export interface GeographicAnalytics {
	countries: CountryStats[];
	cities: CityStats[];
	continents: ContinentStats[];
}

export interface PromoCodeStats {
	code: string;
	count: number;
}

export interface PromoCodeAnalytics {
	top_codes: PromoCodeStats[];
	with_code: number;
	without_code: number;
}

// Cloudflare request.cf properties we use
export interface CFProperties {
	country?: string;
	city?: string;
	continent?: string;
}
