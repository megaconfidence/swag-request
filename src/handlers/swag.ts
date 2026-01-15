/**
 * Swag request handlers
 */

import type { Env, SwagRequestInput, CFProperties } from '../types';
import { validateSwagRequest } from '../utils/validation';
import { jsonResponse } from '../utils/response';

// Continent code to name mapping
const CONTINENT_NAMES: Record<string, string> = {
	'AF': 'Africa',
	'AN': 'Antarctica',
	'AS': 'Asia',
	'EU': 'Europe',
	'NA': 'North America',
	'OC': 'Oceania',
	'SA': 'South America',
};

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
		const result = await env.DB.prepare(`
			INSERT INTO swag_requests (name, email, phone, address, promo_code)
			VALUES (?, ?, ?, ?, ?)
		`).bind(
			data.name.trim(),
			email,
			data.phone.trim(),
			data.address.trim(),
			data.promo_code?.trim() || null
		).run();

		// Capture analytics data from Cloudflare's request.cf properties
		const requestId = result.meta.last_row_id;
		if (requestId) {
			const cf = (request.cf || {}) as CFProperties;
			const continentCode = cf.continent || null;
			const continentName = continentCode ? (CONTINENT_NAMES[continentCode] || continentCode) : null;

			await env.DB.prepare(`
				INSERT INTO request_analytics (request_id, country, country_code, city, continent)
				VALUES (?, ?, ?, ?, ?)
			`).bind(
				requestId,
				cf.country || null,
				cf.country || null, // country code is the same as country in cf properties
				cf.city || null,
				continentName
			).run();
		}

		return jsonResponse({ success: true, message: 'Swag request submitted successfully' });
	} catch (error) {
		console.error('Error submitting swag request:', error);
		return jsonResponse({ error: 'Failed to submit request. Please try again.' }, 500);
	}
}
