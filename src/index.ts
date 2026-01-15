/**
 * Cloudflare Swag Request Application
 *
 * A form-based application for users to request Cloudflare swag.
 * Features:
 * - User swag request form with validation
 * - Admin authentication via OTP (restricted to @cloudflare.com emails)
 * - Admin dashboard to manage requests
 * - Email notifications via Resend
 * - Automatic data expiration (TTL: 30 days)
 * - Maximum 10 requests per user
 */

import type { Env } from './types';
import { initializeDatabase, cleanupExpiredData } from './db';
import { jsonResponse } from './utils/response';
import { handleSwagRequestSubmission } from './handlers/swag';
import {
	handleSendOTP,
	handleVerifyOTP,
	handleCheckAuth,
	handleLogout,
	handleGetRequests,
	handleApproveRequest,
	handleDeleteRequest,
	handleExportCSV,
} from './handlers/admin';

// Re-export Env type for worker-configuration.d.ts
export type { Env } from './types';

// Security constants
const MAX_REQUEST_SIZE = 10 * 1024; // 10KB max request body

/**
 * Get allowed origins from environment variable (comma-separated)
 * Example: ALLOWED_ORIGINS=https://example.com,https://app.example.com
 */
function getAllowedOrigins(env: Env): string[] {
	if (env.ALLOWED_ORIGINS) {
		return env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(o => o.length > 0);
	}
	return [];
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
	if (!origin) return false;
	// Allow localhost for development
	if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
		return true;
	}
	return allowedOrigins.includes(origin);
}

/**
 * Get security headers
 */
function getSecurityHeaders(origin: string | null, allowedOrigins: string[]): Record<string, string> {
	const corsOrigin = isOriginAllowed(origin, allowedOrigins) ? origin! : allowedOrigins[0];
	
	return {
		'Access-Control-Allow-Origin': corsOrigin,
		'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
		'Access-Control-Allow-Credentials': 'true',
		'Access-Control-Max-Age': '86400',
		'X-Content-Type-Options': 'nosniff',
		'X-Frame-Options': 'DENY',
		'X-XSS-Protection': '1; mode=block',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
	};
}

/**
 * Check request size limit
 */
function checkRequestSize(request: Request): boolean {
	const contentLength = request.headers.get('Content-Length');
	if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
		return false;
	}
	return true;
}

/**
 * Validate CSRF - ensure request comes from same origin or allowed origins
 */
function validateCSRF(request: Request, allowedOrigins: string[]): boolean {
	const origin = request.headers.get('Origin');
	const referer = request.headers.get('Referer');
	
	// For same-origin requests, Origin might be null but Referer should match
	if (origin) {
		return isOriginAllowed(origin, allowedOrigins);
	}
	
	if (referer) {
		try {
			const refererUrl = new URL(referer);
			return isOriginAllowed(refererUrl.origin, allowedOrigins);
		} catch {
			return false;
		}
	}
	
	// If no Origin or Referer, check for X-Requested-With header (AJAX requests)
	const xRequestedWith = request.headers.get('X-Requested-With');
	if (xRequestedWith === 'XMLHttpRequest') {
		return true;
	}
	
	// Allow requests without Origin/Referer for non-state-changing methods
	return request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS';
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;
		const origin = request.headers.get('Origin');
		const allowedOrigins = getAllowedOrigins(env);

		// Initialize database (create tables if they don't exist)
		await initializeDatabase(env.DB);

		// Clean up expired data periodically
		ctx.waitUntil(cleanupExpiredData(env.DB));

		// API Routes
		if (path.startsWith('/api/')) {
			const securityHeaders = getSecurityHeaders(origin, allowedOrigins);

			// CORS preflight
			if (method === 'OPTIONS') {
				return new Response(null, { headers: securityHeaders });
			}

			// Check request size for POST requests
			if (method === 'POST' && !checkRequestSize(request)) {
				return jsonResponse({ error: 'Request body too large' }, 413);
			}

			// CSRF protection for state-changing requests
			if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
				if (!validateCSRF(request, allowedOrigins)) {
					return jsonResponse({ error: 'Invalid request origin' }, 403);
				}
			}

			// Helper to add security headers to response
			const addSecurityHeaders = (response: Response): Response => {
				const newHeaders = new Headers(response.headers);
				Object.entries(securityHeaders).forEach(([key, value]) => {
					if (!newHeaders.has(key)) {
						newHeaders.set(key, value);
					}
				});
				return new Response(response.body, {
					status: response.status,
					statusText: response.statusText,
					headers: newHeaders,
				});
			};

			let response: Response;

			// Swag request submission
			if (path === '/api/swag-request' && method === 'POST') {
				response = await handleSwagRequestSubmission(request, env);
				return addSecurityHeaders(response);
			}

			// Admin: Send OTP
			if (path === '/api/admin/send-otp' && method === 'POST') {
				response = await handleSendOTP(request, env);
				return addSecurityHeaders(response);
			}

			// Admin: Verify OTP
			if (path === '/api/admin/verify-otp' && method === 'POST') {
				response = await handleVerifyOTP(request, env);
				return addSecurityHeaders(response);
			}

			// Admin: Check authentication
			if (path === '/api/admin/check-auth' && method === 'GET') {
				response = await handleCheckAuth(request, env);
				return addSecurityHeaders(response);
			}

			// Admin: Logout
			if (path === '/api/admin/logout' && method === 'POST') {
				response = await handleLogout(request, env);
				return addSecurityHeaders(response);
			}

			// Admin: Get all requests
			if (path === '/api/admin/requests' && method === 'GET') {
				response = await handleGetRequests(request, env);
				return addSecurityHeaders(response);
			}

			// Admin: Approve request
			const approveMatch = path.match(/^\/api\/admin\/requests\/(\d+)\/approve$/);
			if (approveMatch && method === 'POST') {
				response = await handleApproveRequest(request, env, parseInt(approveMatch[1]));
				return addSecurityHeaders(response);
			}

			// Admin: Delete request
			const deleteMatch = path.match(/^\/api\/admin\/requests\/(\d+)$/);
			if (deleteMatch && method === 'DELETE') {
				response = await handleDeleteRequest(request, env, parseInt(deleteMatch[1]));
				return addSecurityHeaders(response);
			}

			// Admin: Export CSV
			if (path === '/api/admin/export-csv' && method === 'GET') {
				response = await handleExportCSV(request, env);
				return addSecurityHeaders(response);
			}

			return addSecurityHeaders(jsonResponse({ error: 'Not found' }, 404));
		}

		// Serve static files for admin routes
		if (path === '/admin/login' && env.ASSETS) {
			return env.ASSETS.fetch(new Request(new URL('/admin/login.html', request.url), request));
		}

		if (path === '/admin/dashboard' && env.ASSETS) {
			return env.ASSETS.fetch(new Request(new URL('/admin/dashboard.html', request.url), request));
		}

		// Let Workers Assets handle other requests
		return new Response('Not found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
