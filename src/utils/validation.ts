/**
 * Validation helpers using validator.js
 */

import validator from 'validator';
import type { SwagRequestInput } from '../types';

// Input length limits
const MAX_NAME_LENGTH = 100;
const MIN_NAME_LENGTH = 2;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_LENGTH = 30;
const MIN_PHONE_LENGTH = 7;
const MAX_ADDRESS_LENGTH = 500;
const MIN_ADDRESS_LENGTH = 10;
const MAX_PROMO_CODE_LENGTH = 50;

/**
 * Validate email address using validator.js
 */
export function validateEmail(email: string): boolean {
	return validator.isEmail(email, { 
		allow_display_name: false,
		allow_utf8_local_part: false,
		require_tld: true
	});
}

/**
 * Validate phone number using validator.js
 * Accepts various international formats
 */
export function validatePhone(phone: string): boolean {
	// Remove common formatting characters for validation
	const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
	// Check if it's a valid mobile phone or matches a general phone pattern
	return validator.isMobilePhone(cleaned, 'any', { strictMode: false }) ||
		(validator.isLength(phone, { min: MIN_PHONE_LENGTH, max: MAX_PHONE_LENGTH }) &&
		 validator.matches(phone, /^[\d\s\+\-\(\)\.]+$/) &&
		 validator.matches(cleaned, /^\+?\d{7,15}$/));
}

/**
 * Validate name - alphanumeric with spaces, hyphens, apostrophes
 */
export function validateName(name: string): boolean {
	// Allow letters, spaces, hyphens, apostrophes, and periods (for initials)
	return validator.matches(name, /^[\p{L}\s\-'.]+$/u) && 
		!validator.isEmpty(name) &&
		validator.isLength(name, { min: MIN_NAME_LENGTH, max: MAX_NAME_LENGTH });
}

/**
 * Validate address - basic check for non-empty with reasonable content
 */
export function validateAddress(address: string): boolean {
	return !validator.isEmpty(address) &&
		validator.isLength(address, { min: MIN_ADDRESS_LENGTH, max: MAX_ADDRESS_LENGTH }) &&
		// Must contain at least some alphanumeric characters
		validator.matches(address, /[a-zA-Z0-9]/);
}

/**
 * Validate promo code - alphanumeric with some special chars
 */
export function validatePromoCode(promoCode: string): boolean {
	if (validator.isEmpty(promoCode)) {
		return true; // Empty is valid (optional field)
	}
	return validator.isLength(promoCode, { max: MAX_PROMO_CODE_LENGTH }) &&
		validator.matches(promoCode, /^[a-zA-Z0-9\-_]+$/);
}

/**
 * Sanitize and escape string input
 */
export function sanitizeString(input: string): string {
	return validator.escape(validator.trim(input));
}

/**
 * Validate swag request input with validator.js
 */
export function validateSwagRequest(data: SwagRequestInput): { valid: boolean; error?: string } {
	// Validate name
	if (!data.name || typeof data.name !== 'string') {
		return { valid: false, error: 'Name is required' };
	}
	const name = validator.trim(data.name);
	if (validator.isEmpty(name)) {
		return { valid: false, error: 'Name is required' };
	}
	if (!validator.isLength(name, { min: MIN_NAME_LENGTH })) {
		return { valid: false, error: 'Name must be at least 2 characters' };
	}
	if (!validator.isLength(name, { max: MAX_NAME_LENGTH })) {
		return { valid: false, error: `Name must be less than ${MAX_NAME_LENGTH} characters` };
	}
	if (!validator.matches(name, /^[\p{L}\s\-'.]+$/u)) {
		return { valid: false, error: 'Name contains invalid characters' };
	}

	// Validate email
	if (!data.email || typeof data.email !== 'string') {
		return { valid: false, error: 'Email is required' };
	}
	const email = validator.trim(data.email).toLowerCase();
	if (validator.isEmpty(email)) {
		return { valid: false, error: 'Email is required' };
	}
	if (!validator.isLength(email, { max: MAX_EMAIL_LENGTH })) {
		return { valid: false, error: `Email must be less than ${MAX_EMAIL_LENGTH} characters` };
	}
	if (!validator.isEmail(email, { allow_display_name: false, require_tld: true })) {
		return { valid: false, error: 'Please provide a valid email address' };
	}

	// Validate phone
	if (!data.phone || typeof data.phone !== 'string') {
		return { valid: false, error: 'Phone number is required' };
	}
	const phone = validator.trim(data.phone);
	if (validator.isEmpty(phone)) {
		return { valid: false, error: 'Phone number is required' };
	}
	if (!validator.isLength(phone, { max: MAX_PHONE_LENGTH })) {
		return { valid: false, error: `Phone number must be less than ${MAX_PHONE_LENGTH} characters` };
	}
	if (!validatePhone(phone)) {
		return { valid: false, error: 'Please provide a valid phone number' };
	}

	// Validate address
	if (!data.address || typeof data.address !== 'string') {
		return { valid: false, error: 'Address is required' };
	}
	const address = validator.trim(data.address);
	if (validator.isEmpty(address)) {
		return { valid: false, error: 'Address is required' };
	}
	if (!validator.isLength(address, { min: MIN_ADDRESS_LENGTH })) {
		return { valid: false, error: 'Please provide a complete shipping address' };
	}
	if (!validator.isLength(address, { max: MAX_ADDRESS_LENGTH })) {
		return { valid: false, error: `Address must be less than ${MAX_ADDRESS_LENGTH} characters` };
	}

	// Validate promo code (optional)
	if (data.promo_code !== undefined && data.promo_code !== null && data.promo_code !== '') {
		if (typeof data.promo_code !== 'string') {
			return { valid: false, error: 'Promo code must be a string' };
		}
		const promoCode = validator.trim(data.promo_code);
		if (!validator.isEmpty(promoCode)) {
			if (!validator.isLength(promoCode, { max: MAX_PROMO_CODE_LENGTH })) {
				return { valid: false, error: `Promo code must be less than ${MAX_PROMO_CODE_LENGTH} characters` };
			}
			if (!validator.isAlphanumeric(promoCode.replace(/[-_]/g, ''))) {
				return { valid: false, error: 'Promo code can only contain letters, numbers, hyphens and underscores' };
			}
		}
	}

	return { valid: true };
}

/**
 * Validate OTP format (6 digits) using validator.js
 */
export function validateOTP(otp: string): boolean {
	return validator.isNumeric(otp, { no_symbols: true }) && 
		validator.isLength(otp, { min: 6, max: 6 });
}
