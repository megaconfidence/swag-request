/**
 * Admin handlers for authentication and request management
 */

import type { Env, OTPInput, VerifyOTPInput, AdminSession, SwagRequest } from '../types';
import { emailPattern } from '../utils/validation';
import { generateOTP, generateSessionToken } from '../utils/crypto';
import { sendEmail } from '../utils/email';
import { jsonResponse } from '../utils/response';
import { getSessionToken, validateAdminSession } from '../utils/session';

/**
 * Handle send OTP request
 */
export async function handleSendOTP(request: Request, env: Env): Promise<Response> {
	try {
		const data = await request.json() as OTPInput;
		const email = data.email?.trim().toLowerCase();

		// Validate email
		if (!email || !emailPattern.test(email)) {
			return jsonResponse({ error: 'Please provide a valid email address' }, 400);
		}

		// Check if email is @cloudflare.com
		if (!email.endsWith('@cloudflare.com')) {
			return jsonResponse({ error: 'Only @cloudflare.com email addresses are allowed' }, 403);
		}

		// Generate OTP
		const otp = generateOTP();
		const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

		// Store OTP in database
		await env.DB.prepare(`
			INSERT INTO admin_sessions (email, otp, otp_expires_at)
			VALUES (?, ?, ?)
		`).bind(email, otp, otpExpiresAt).run();

		// Send OTP email
		const emailSent = await sendEmail(
			env.RESEND_API_KEY,
			env.FROM_EMAIL,
			email,
			'Your Cloudflare Swag Admin Login OTP',
			`
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<h2 style="color: #F6821F;">Cloudflare Swag Admin</h2>
				<p>Your one-time password (OTP) for admin login is:</p>
				<div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
					<span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #404040;">${otp}</span>
				</div>
				<p style="color: #666;">This OTP will expire in 10 minutes.</p>
				<p style="color: #666;">If you didn't request this OTP, please ignore this email.</p>
			</div>
			`
		);

		// For development, if email fails, log the OTP
		if (!emailSent) {
			console.log(`OTP for ${email}: ${otp}`);
		}

		return jsonResponse({ success: true, message: 'OTP sent successfully' });
	} catch (error) {
		console.error('Error sending OTP:', error);
		return jsonResponse({ error: 'Failed to send OTP. Please try again.' }, 500);
	}
}

/**
 * Handle verify OTP request
 */
export async function handleVerifyOTP(request: Request, env: Env): Promise<Response> {
	try {
		const data = await request.json() as VerifyOTPInput;
		const email = data.email?.trim().toLowerCase();
		const otp = data.otp?.trim();

		if (!email || !otp) {
			return jsonResponse({ error: 'Email and OTP are required' }, 400);
		}

		// Verify OTP
		const now = new Date().toISOString();
		const session = await env.DB.prepare(`
			SELECT * FROM admin_sessions 
			WHERE email = ? AND otp = ? AND otp_expires_at > ? AND session_token IS NULL
			ORDER BY created_at DESC
			LIMIT 1
		`).bind(email, otp, now).first<AdminSession>();

		if (!session) {
			return jsonResponse({ error: 'Invalid or expired OTP' }, 401);
		}

		// Generate session token
		const sessionToken = generateSessionToken();
		const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

		// Update session with token
		await env.DB.prepare(`
			UPDATE admin_sessions 
			SET session_token = ?, session_expires_at = ?
			WHERE id = ?
		`).bind(sessionToken, sessionExpiresAt, session.id).run();

		return jsonResponse(
			{ success: true, message: 'Login successful' },
			200,
			{
				'Set-Cookie': `admin_session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`,
			}
		);
	} catch (error) {
		console.error('Error verifying OTP:', error);
		return jsonResponse({ error: 'Failed to verify OTP. Please try again.' }, 500);
	}
}

/**
 * Handle check auth request
 */
export async function handleCheckAuth(request: Request, env: Env): Promise<Response> {
	const sessionToken = getSessionToken(request);
	const isValid = await validateAdminSession(env.DB, sessionToken);

	if (!isValid) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	}

	return jsonResponse({ authenticated: true });
}

/**
 * Handle logout request
 */
export async function handleLogout(request: Request, env: Env): Promise<Response> {
	const sessionToken = getSessionToken(request);

	if (sessionToken) {
		await env.DB.prepare('DELETE FROM admin_sessions WHERE session_token = ?').bind(sessionToken).run();
	}

	return jsonResponse(
		{ success: true },
		200,
		{
			'Set-Cookie': 'admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
		}
	);
}

/**
 * Handle get requests (list all swag requests)
 */
export async function handleGetRequests(request: Request, env: Env): Promise<Response> {
	const sessionToken = getSessionToken(request);
	const isValid = await validateAdminSession(env.DB, sessionToken);

	if (!isValid) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	}

	try {
		const requests = await env.DB.prepare(`
			SELECT * FROM swag_requests 
			WHERE expires_at > datetime('now')
			ORDER BY created_at DESC
		`).all<SwagRequest>();

		return jsonResponse(requests.results || []);
	} catch (error) {
		console.error('Error fetching requests:', error);
		return jsonResponse({ error: 'Failed to fetch requests' }, 500);
	}
}

/**
 * Handle approve request
 */
export async function handleApproveRequest(
	request: Request,
	env: Env,
	requestId: number
): Promise<Response> {
	const sessionToken = getSessionToken(request);
	const isValid = await validateAdminSession(env.DB, sessionToken);

	if (!isValid) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	}

	try {
		// Get the request
		const swagRequest = await env.DB.prepare(
			'SELECT * FROM swag_requests WHERE id = ?'
		).bind(requestId).first<SwagRequest>();

		if (!swagRequest) {
			return jsonResponse({ error: 'Request not found' }, 404);
		}

		// Update status
		await env.DB.prepare(
			'UPDATE swag_requests SET status = ? WHERE id = ?'
		).bind('approved', requestId).run();

		// Send approval email
		await sendEmail(
			env.RESEND_API_KEY,
			env.FROM_EMAIL,
			swagRequest.email,
			'Your Cloudflare Swag Request Has Been Approved!',
			`
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<h2 style="color: #F6821F;">Great News, ${swagRequest.name}!</h2>
				<p>Your Cloudflare swag request has been approved!</p>
				<div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
					<p><strong>Shipping Address:</strong></p>
					<p style="color: #666;">${swagRequest.address}</p>
				</div>
				<p>Your swag will be shipped to the address above. You can expect to receive it within 2-4 weeks.</p>
				<p style="color: #666; margin-top: 30px;">Thank you for being part of the Cloudflare community!</p>
			</div>
			`
		);

		return jsonResponse({ success: true, message: 'Request approved' });
	} catch (error) {
		console.error('Error approving request:', error);
		return jsonResponse({ error: 'Failed to approve request' }, 500);
	}
}

/**
 * Handle delete request
 */
export async function handleDeleteRequest(
	request: Request,
	env: Env,
	requestId: number
): Promise<Response> {
	const sessionToken = getSessionToken(request);
	const isValid = await validateAdminSession(env.DB, sessionToken);

	if (!isValid) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	}

	try {
		const result = await env.DB.prepare(
			'DELETE FROM swag_requests WHERE id = ?'
		).bind(requestId).run();

		if (result.meta.changes === 0) {
			return jsonResponse({ error: 'Request not found' }, 404);
		}

		return jsonResponse({ success: true, message: 'Request deleted' });
	} catch (error) {
		console.error('Error deleting request:', error);
		return jsonResponse({ error: 'Failed to delete request' }, 500);
	}
}

/**
 * Handle export CSV
 */
export async function handleExportCSV(request: Request, env: Env): Promise<Response> {
	const sessionToken = getSessionToken(request);
	const isValid = await validateAdminSession(env.DB, sessionToken);

	if (!isValid) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	}

	try {
		const requests = await env.DB.prepare(`
			SELECT name, email, phone, address, created_at 
			FROM swag_requests 
			WHERE status = 'approved' AND expires_at > datetime('now')
			ORDER BY created_at DESC
		`).all<SwagRequest>();

		// Generate CSV
		const headers = ['Name', 'Email', 'Phone', 'Address', 'Created At'];
		const rows = (requests.results || []).map(r => [
			`"${r.name.replace(/"/g, '""')}"`,
			`"${r.email.replace(/"/g, '""')}"`,
			`"${r.phone.replace(/"/g, '""')}"`,
			`"${r.address.replace(/"/g, '""')}"`,
			`"${r.created_at}"`,
		]);

		const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

		return new Response(csv, {
			headers: {
				'Content-Type': 'text/csv',
				'Content-Disposition': `attachment; filename="approved-requests-${new Date().toISOString().split('T')[0]}.csv"`,
			},
		});
	} catch (error) {
		console.error('Error exporting CSV:', error);
		return jsonResponse({ error: 'Failed to export CSV' }, 500);
	}
}
