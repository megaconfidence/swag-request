/**
 * Swag request handlers
 */

import type { Env, SwagRequestInput } from '../types';
import { validateSwagRequest } from '../utils/validation';
import { jsonResponse } from '../utils/response';

/**
 * Handle swag request submission
 */
export async function handleSwagRequestSubmission(
	request: Request,
	env: Env
): Promise<Response> {
	try {
		const data = await request.json() as SwagRequestInput;

		// Validate input
		const validation = validateSwagRequest(data);
		if (!validation.valid) {
			return jsonResponse({ error: validation.error }, 400);
		}

		const email = data.email.trim().toLowerCase();

		// Check request limit (max 10 per user)
		const existingCount = await env.DB.prepare(
			'SELECT COUNT(*) as count FROM swag_requests WHERE email = ?'
		).bind(email).first<{ count: number }>();

		if (existingCount && existingCount.count >= 10) {
			return jsonResponse({
				error: 'You have reached the maximum limit of 10 swag requests. Please wait for your existing requests to expire or be processed.'
			}, 400);
		}

		// Insert the request
		await env.DB.prepare(`
			INSERT INTO swag_requests (name, email, phone, address, promo_code)
			VALUES (?, ?, ?, ?, ?)
		`).bind(
			data.name.trim(),
			email,
			data.phone.trim(),
			data.address.trim(),
			data.promo_code?.trim() || null
		).run();

		return jsonResponse({ success: true, message: 'Swag request submitted successfully' });
	} catch (error) {
		console.error('Error submitting swag request:', error);
		return jsonResponse({ error: 'Failed to submit request. Please try again.' }, 500);
	}
}
