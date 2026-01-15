/**
 * Cloudflare Swag Request Application
 *
 * A form-based application for users to request Cloudflare swag.
 * Features:
 * - User swag request form with validation
 * - Admin authentication via OTP (restricted to @cloudflare.com emails)
 * - Admin dashboard to manage requests
 * - Email notifications via Resend
 * - Automatic data expiration (TTL: 1 week)
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

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		// Initialize database (create tables if they don't exist)
		await initializeDatabase(env.DB);

		// Clean up expired data periodically
		ctx.waitUntil(cleanupExpiredData(env.DB));

		// API Routes
		if (path.startsWith('/api/')) {
			// CORS headers for API routes
			if (method === 'OPTIONS') {
				return new Response(null, {
					headers: {
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
						'Access-Control-Allow-Headers': 'Content-Type',
					},
				});
			}

			// Swag request submission
			if (path === '/api/swag-request' && method === 'POST') {
				return handleSwagRequestSubmission(request, env);
			}

			// Admin: Send OTP
			if (path === '/api/admin/send-otp' && method === 'POST') {
				return handleSendOTP(request, env);
			}

			// Admin: Verify OTP
			if (path === '/api/admin/verify-otp' && method === 'POST') {
				return handleVerifyOTP(request, env);
			}

			// Admin: Check authentication
			if (path === '/api/admin/check-auth' && method === 'GET') {
				return handleCheckAuth(request, env);
			}

			// Admin: Logout
			if (path === '/api/admin/logout' && method === 'POST') {
				return handleLogout(request, env);
			}

			// Admin: Get all requests
			if (path === '/api/admin/requests' && method === 'GET') {
				return handleGetRequests(request, env);
			}

			// Admin: Approve request
			const approveMatch = path.match(/^\/api\/admin\/requests\/(\d+)\/approve$/);
			if (approveMatch && method === 'POST') {
				return handleApproveRequest(request, env, parseInt(approveMatch[1]));
			}

			// Admin: Delete request
			const deleteMatch = path.match(/^\/api\/admin\/requests\/(\d+)$/);
			if (deleteMatch && method === 'DELETE') {
				return handleDeleteRequest(request, env, parseInt(deleteMatch[1]));
			}

			// Admin: Export CSV
			if (path === '/api/admin/export-csv' && method === 'GET') {
				return handleExportCSV(request, env);
			}

			return jsonResponse({ error: 'Not found' }, 404);
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
