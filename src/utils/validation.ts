/**
 * Validation helpers
 */

import type { SwagRequestInput } from '../types';

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const phonePattern = /^[\d\s\+\-\(\)]{7,}$/;

export function validateSwagRequest(data: SwagRequestInput): { valid: boolean; error?: string } {
	if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
		return { valid: false, error: 'Name must be at least 2 characters' };
	}
	if (!data.email || typeof data.email !== 'string' || !emailPattern.test(data.email.trim())) {
		return { valid: false, error: 'Please provide a valid email address' };
	}
	if (!data.phone || typeof data.phone !== 'string' || !phonePattern.test(data.phone.trim())) {
		return { valid: false, error: 'Please provide a valid phone number' };
	}
	if (!data.address || typeof data.address !== 'string' || data.address.trim().length < 10) {
		return { valid: false, error: 'Please provide a complete shipping address' };
	}
	return { valid: true };
}
