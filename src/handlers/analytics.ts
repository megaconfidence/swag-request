/**
 * Analytics handlers for admin dashboard
 */

import type { 
	Env, 
	AnalyticsSummary, 
	GeographicAnalytics, 
	PromoCodeAnalytics,
	CountryStats,
	CityStats,
	ContinentStats,
	PromoCodeStats
} from '../types';
import { jsonResponse } from '../utils/response';
import { getSessionToken, validateAdminSession } from '../utils/session';

/**
 * Handle analytics summary request
 */
export async function handleAnalyticsSummary(
	request: Request,
	env: Env
): Promise<Response> {
	const sessionToken = getSessionToken(request);
	const isValid = await validateAdminSession(env.DB, sessionToken);

	if (!isValid) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	}

	try {
		// Get total counts by status
		const stats = await env.DB.prepare(`
			SELECT 
				COUNT(*) as total,
				SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
				SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
				SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
			FROM swag_requests
			WHERE expires_at > datetime('now')
		`).first<{ total: number; pending: number; approved: number; rejected: number }>();

		const total = stats?.total || 0;
		const pending = stats?.pending || 0;
		const approved = stats?.approved || 0;
		const rejected = stats?.rejected || 0;
		
		// Calculate approval rate (approved / (approved + rejected))
		const decided = approved + rejected;
		const approval_rate = decided > 0 ? Math.round((approved / decided) * 1000) / 10 : 0;

		const summary: AnalyticsSummary = {
			total,
			pending,
			approved,
			rejected,
			approval_rate
		};

		return jsonResponse(summary);
	} catch (error) {
		console.error('Error fetching analytics summary:', error);
		return jsonResponse({ error: 'Failed to fetch analytics summary' }, 500);
	}
}

/**
 * Handle geographic analytics request
 */
export async function handleGeographicAnalytics(
	request: Request,
	env: Env
): Promise<Response> {
	const sessionToken = getSessionToken(request);
	const isValid = await validateAdminSession(env.DB, sessionToken);

	if (!isValid) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	}

	try {
		// Get top 10 countries
		const countriesResult = await env.DB.prepare(`
			SELECT 
				country as name,
				country_code as code,
				COUNT(*) as count
			FROM request_analytics ra
			JOIN swag_requests sr ON ra.request_id = sr.id
			WHERE ra.country IS NOT NULL 
				AND ra.country != ''
				AND sr.expires_at > datetime('now')
			GROUP BY country_code
			ORDER BY count DESC
			LIMIT 10
		`).all<CountryStats>();

		// Get top 10 cities
		const citiesResult = await env.DB.prepare(`
			SELECT 
				city as name,
				country_code as country,
				COUNT(*) as count
			FROM request_analytics ra
			JOIN swag_requests sr ON ra.request_id = sr.id
			WHERE ra.city IS NOT NULL 
				AND ra.city != ''
				AND sr.expires_at > datetime('now')
			GROUP BY city, country_code
			ORDER BY count DESC
			LIMIT 10
		`).all<CityStats>();

		// Get continent breakdown
		const continentsResult = await env.DB.prepare(`
			SELECT 
				continent as name,
				COUNT(*) as count
			FROM request_analytics ra
			JOIN swag_requests sr ON ra.request_id = sr.id
			WHERE ra.continent IS NOT NULL 
				AND ra.continent != ''
				AND sr.expires_at > datetime('now')
			GROUP BY continent
			ORDER BY count DESC
		`).all<ContinentStats>();

		const analytics: GeographicAnalytics = {
			countries: countriesResult.results || [],
			cities: citiesResult.results || [],
			continents: continentsResult.results || []
		};

		return jsonResponse(analytics);
	} catch (error) {
		console.error('Error fetching geographic analytics:', error);
		return jsonResponse({ error: 'Failed to fetch geographic analytics' }, 500);
	}
}

/**
 * Handle promo code analytics request
 */
export async function handlePromoCodeAnalytics(
	request: Request,
	env: Env
): Promise<Response> {
	const sessionToken = getSessionToken(request);
	const isValid = await validateAdminSession(env.DB, sessionToken);

	if (!isValid) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	}

	try {
		// Get top 10 promo codes
		const topCodesResult = await env.DB.prepare(`
			SELECT 
				promo_code as code,
				COUNT(*) as count
			FROM swag_requests
			WHERE promo_code IS NOT NULL 
				AND promo_code != ''
				AND expires_at > datetime('now')
			GROUP BY promo_code
			ORDER BY count DESC
			LIMIT 10
		`).all<PromoCodeStats>();

		// Get count with/without promo code
		const promoStats = await env.DB.prepare(`
			SELECT 
				SUM(CASE WHEN promo_code IS NOT NULL AND promo_code != '' THEN 1 ELSE 0 END) as with_code,
				SUM(CASE WHEN promo_code IS NULL OR promo_code = '' THEN 1 ELSE 0 END) as without_code
			FROM swag_requests
			WHERE expires_at > datetime('now')
		`).first<{ with_code: number; without_code: number }>();

		const analytics: PromoCodeAnalytics = {
			top_codes: topCodesResult.results || [],
			with_code: promoStats?.with_code || 0,
			without_code: promoStats?.without_code || 0
		};

		return jsonResponse(analytics);
	} catch (error) {
		console.error('Error fetching promo code analytics:', error);
		return jsonResponse({ error: 'Failed to fetch promo code analytics' }, 500);
	}
}
