import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../src/index';

// Type for our test environment
declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
		RESEND_API_KEY: string;
	}
}

// Response data types
interface SuccessResponse {
	success: boolean;
	message?: string;
}

interface ErrorResponse {
	error: string;
}

interface AuthResponse {
	authenticated: boolean;
}

interface SwagRequestRow {
	id?: number;
	name: string;
	email: string;
	phone?: string;
	address?: string;
	promo_code?: string | null;
	status?: string;
	created_at?: string;
	expires_at?: string;
}

interface SessionRow {
	id?: number;
	email?: string;
	otp?: string;
	session_token?: string;
	otp_expires_at?: string;
	session_expires_at?: string;
}

describe('Swag Request Application', () => {
	// Helper to create a request
	const createRequest = (path: string, options: RequestInit = {}) => {
		return new Request(`http://localhost${path}`, options);
	};

	// Helper to create JSON POST request
	const createPostRequest = (path: string, body: unknown) => {
		return createRequest(path, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
	};

	beforeAll(async () => {
		// Initialize database tables
		await env.DB.exec("CREATE TABLE IF NOT EXISTS swag_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL, promo_code TEXT, status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME DEFAULT (datetime('now', '+30 days')))");

		await env.DB.exec("CREATE TABLE IF NOT EXISTS admin_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, otp TEXT NOT NULL, session_token TEXT, otp_expires_at DATETIME NOT NULL, session_expires_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
	});

	beforeEach(async () => {
		// Clean up tables before each test
		await env.DB.exec('DELETE FROM swag_requests');
		await env.DB.exec('DELETE FROM admin_sessions');
	});

	// ==========================================
	// SWAG REQUEST SUBMISSION TESTS
	// ==========================================
	describe('POST /api/swag-request', () => {
		it('should submit a valid swag request', async () => {
			const request = createPostRequest('/api/swag-request', {
				name: 'John Doe',
				email: 'john@example.com',
				phone: '+1 555 123 4567',
				address: '123 Main Street, City, State, 12345, USA',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const data = await response.json() as SuccessResponse;
			expect(data.success).toBe(true);

			// Verify in database
			const result = await env.DB.prepare('SELECT * FROM swag_requests WHERE email = ?')
				.bind('john@example.com')
				.first<SwagRequestRow>();
			expect(result).toBeTruthy();
			expect(result?.name).toBe('John Doe');
		});

		it('should reject request with invalid name (too short)', async () => {
			const request = createPostRequest('/api/swag-request', {
				name: 'J',
				email: 'john@example.com',
				phone: '+1 555 123 4567',
				address: '123 Main Street, City, State, 12345, USA',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const data = await response.json() as ErrorResponse;
			expect(data.error).toContain('Name');
		});

		it('should reject request with invalid email', async () => {
			const request = createPostRequest('/api/swag-request', {
				name: 'John Doe',
				email: 'invalid-email',
				phone: '+1 555 123 4567',
				address: '123 Main Street, City, State, 12345, USA',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const data = await response.json() as ErrorResponse;
			expect(data.error).toContain('email');
		});

		it('should reject request with invalid phone', async () => {
			const request = createPostRequest('/api/swag-request', {
				name: 'John Doe',
				email: 'john@example.com',
				phone: '12',
				address: '123 Main Street, City, State, 12345, USA',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const data = await response.json() as ErrorResponse;
			expect(data.error).toContain('phone');
		});

		it('should reject request with invalid address (too short)', async () => {
			const request = createPostRequest('/api/swag-request', {
				name: 'John Doe',
				email: 'john@example.com',
				phone: '+1 555 123 4567',
				address: '123 Main',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const data = await response.json() as ErrorResponse;
			expect(data.error).toContain('address');
		});

		it('should enforce 10 request limit per user', async () => {
			// Insert 10 existing requests for the same email
			for (let i = 0; i < 10; i++) {
				await env.DB.prepare(`
					INSERT INTO swag_requests (name, email, phone, address)
					VALUES (?, ?, ?, ?)
				`).bind('John Doe', 'john@example.com', '+1 555 123 4567', '123 Main Street, City, State, 12345').run();
			}

			// Try to submit 11th request
			const request = createPostRequest('/api/swag-request', {
				name: 'John Doe',
				email: 'john@example.com',
				phone: '+1 555 123 4567',
				address: '456 Another Street, City, State, 12345, USA',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const data = await response.json() as ErrorResponse;
			expect(data.error).toContain('maximum limit');
		});

		it('should normalize email to lowercase', async () => {
			const request = createPostRequest('/api/swag-request', {
				name: 'John Doe',
				email: 'JOHN@EXAMPLE.COM',
				phone: '+1 555 123 4567',
				address: '123 Main Street, City, State, 12345, USA',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);

			// Verify email is stored in lowercase
			const result = await env.DB.prepare('SELECT email FROM swag_requests').first<SwagRequestRow>();
			expect(result?.email).toBe('john@example.com');
		});

		it('should submit a valid swag request with promo code', async () => {
			const request = createPostRequest('/api/swag-request', {
				name: 'John Doe',
				email: 'john@example.com',
				phone: '+1 555 123 4567',
				address: '123 Main Street, City, State, 12345, USA',
				promo_code: 'SUMMER2026',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const data = await response.json() as SuccessResponse;
			expect(data.success).toBe(true);

			// Verify promo_code in database
			const result = await env.DB.prepare('SELECT * FROM swag_requests WHERE email = ?')
				.bind('john@example.com')
				.first<SwagRequestRow>();
			expect(result).toBeTruthy();
			expect(result?.promo_code).toBe('SUMMER2026');
		});

		it('should submit a valid swag request without promo code', async () => {
			const request = createPostRequest('/api/swag-request', {
				name: 'Jane Doe',
				email: 'jane@example.com',
				phone: '+1 555 123 4567',
				address: '123 Main Street, City, State, 12345, USA',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const data = await response.json() as SuccessResponse;
			expect(data.success).toBe(true);

			// Verify promo_code is null in database
			const result = await env.DB.prepare('SELECT * FROM swag_requests WHERE email = ?')
				.bind('jane@example.com')
				.first<SwagRequestRow>();
			expect(result).toBeTruthy();
			expect(result?.promo_code).toBeNull();
		});

		it('should trim whitespace from promo code', async () => {
			const request = createPostRequest('/api/swag-request', {
				name: 'John Doe',
				email: 'john@example.com',
				phone: '+1 555 123 4567',
				address: '123 Main Street, City, State, 12345, USA',
				promo_code: '  SUMMER2026  ',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);

			// Verify promo_code is trimmed in database
			const result = await env.DB.prepare('SELECT promo_code FROM swag_requests WHERE email = ?')
				.bind('john@example.com')
				.first<SwagRequestRow>();
			expect(result?.promo_code).toBe('SUMMER2026');
		});

		it('should store null for empty promo code string', async () => {
			const request = createPostRequest('/api/swag-request', {
				name: 'John Doe',
				email: 'john@example.com',
				phone: '+1 555 123 4567',
				address: '123 Main Street, City, State, 12345, USA',
				promo_code: '',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);

			// Verify promo_code is null for empty string
			const result = await env.DB.prepare('SELECT promo_code FROM swag_requests WHERE email = ?')
				.bind('john@example.com')
				.first<SwagRequestRow>();
			expect(result?.promo_code).toBeNull();
		});
	});

	// ==========================================
	// ADMIN OTP AUTHENTICATION TESTS
	// ==========================================
	describe('POST /api/admin/send-otp', () => {
		it('should send OTP for valid @cloudflare.com email', async () => {
			const request = createPostRequest('/api/admin/send-otp', {
				email: 'admin@cloudflare.com',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const data = await response.json() as SuccessResponse;
			expect(data.success).toBe(true);

			// Verify OTP was created in database
			const session = await env.DB.prepare('SELECT * FROM admin_sessions WHERE email = ?')
				.bind('admin@cloudflare.com')
				.first<SessionRow>();
			expect(session).toBeTruthy();
			expect(session?.otp).toHaveLength(6);
		});

		it('should reject non-cloudflare.com email', async () => {
			const request = createPostRequest('/api/admin/send-otp', {
				email: 'admin@gmail.com',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(403);
			const data = await response.json() as ErrorResponse;
			expect(data.error).toContain('cloudflare.com');
		});

		it('should reject invalid email format', async () => {
			const request = createPostRequest('/api/admin/send-otp', {
				email: 'invalid-email',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const data = await response.json() as ErrorResponse;
			expect(data.error).toContain('email');
		});

		it('should normalize email to lowercase', async () => {
			const request = createPostRequest('/api/admin/send-otp', {
				email: 'ADMIN@CLOUDFLARE.COM',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);

			// Verify email is stored in lowercase
			const session = await env.DB.prepare('SELECT email FROM admin_sessions').first<SessionRow>();
			expect(session?.email).toBe('admin@cloudflare.com');
		});
	});

	describe('POST /api/admin/verify-otp', () => {
		it('should verify valid OTP and create session', async () => {
			// Create an OTP session
			const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
			await env.DB.prepare(`
				INSERT INTO admin_sessions (email, otp, otp_expires_at)
				VALUES (?, ?, ?)
			`).bind('admin@cloudflare.com', '123456', otpExpiresAt).run();

			const request = createPostRequest('/api/admin/verify-otp', {
				email: 'admin@cloudflare.com',
				otp: '123456',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const data = await response.json() as SuccessResponse;
			expect(data.success).toBe(true);

			// Check for session cookie
			const setCookie = response.headers.get('Set-Cookie');
			expect(setCookie).toContain('admin_session=');

			// Verify session token was stored
			const session = await env.DB.prepare('SELECT session_token FROM admin_sessions WHERE email = ?')
				.bind('admin@cloudflare.com')
				.first<SessionRow>();
			expect(session?.session_token).toBeTruthy();
		});

		it('should reject invalid OTP', async () => {
			// Create an OTP session
			const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
			await env.DB.prepare(`
				INSERT INTO admin_sessions (email, otp, otp_expires_at)
				VALUES (?, ?, ?)
			`).bind('admin@cloudflare.com', '123456', otpExpiresAt).run();

			const request = createPostRequest('/api/admin/verify-otp', {
				email: 'admin@cloudflare.com',
				otp: '999999', // Wrong OTP
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
			const data = await response.json() as ErrorResponse;
			expect(data.error).toContain('Invalid');
		});

		it('should reject expired OTP', async () => {
			// Create an expired OTP session
			const otpExpiresAt = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minute ago
			await env.DB.prepare(`
				INSERT INTO admin_sessions (email, otp, otp_expires_at)
				VALUES (?, ?, ?)
			`).bind('admin@cloudflare.com', '123456', otpExpiresAt).run();

			const request = createPostRequest('/api/admin/verify-otp', {
				email: 'admin@cloudflare.com',
				otp: '123456',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
			const data = await response.json() as ErrorResponse;
			expect(data.error).toContain('Invalid');
		});
	});

	// ==========================================
	// ADMIN AUTHENTICATION TESTS
	// ==========================================
	describe('GET /api/admin/check-auth', () => {
		it('should return authenticated for valid session', async () => {
			// Create a valid session
			const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
			await env.DB.prepare(`
				INSERT INTO admin_sessions (email, otp, otp_expires_at, session_token, session_expires_at)
				VALUES (?, ?, ?, ?, ?)
			`).bind('admin@cloudflare.com', '123456', new Date().toISOString(), 'valid-session-token', sessionExpiresAt).run();

			const request = createRequest('/api/admin/check-auth', {
				headers: { 'Cookie': 'admin_session=valid-session-token' },
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const data = await response.json() as AuthResponse;
			expect(data.authenticated).toBe(true);
		});

		it('should return unauthorized for invalid session', async () => {
			const request = createRequest('/api/admin/check-auth', {
				headers: { 'Cookie': 'admin_session=invalid-token' },
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
		});

		it('should return unauthorized without session cookie', async () => {
			const request = createRequest('/api/admin/check-auth');

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
		});
	});

	describe('POST /api/admin/logout', () => {
		it('should clear session on logout', async () => {
			// Create a valid session
			const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
			await env.DB.prepare(`
				INSERT INTO admin_sessions (email, otp, otp_expires_at, session_token, session_expires_at)
				VALUES (?, ?, ?, ?, ?)
			`).bind('admin@cloudflare.com', '123456', new Date().toISOString(), 'valid-session-token', sessionExpiresAt).run();

			const request = createRequest('/api/admin/logout', {
				method: 'POST',
				headers: { 'Cookie': 'admin_session=valid-session-token' },
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);

			// Check cookie is cleared
			const setCookie = response.headers.get('Set-Cookie');
			expect(setCookie).toContain('Max-Age=0');

			// Verify session was deleted
			const session = await env.DB.prepare('SELECT * FROM admin_sessions WHERE session_token = ?')
				.bind('valid-session-token')
				.first();
			expect(session).toBeNull();
		});
	});

	// ==========================================
	// ADMIN REQUESTS MANAGEMENT TESTS
	// ==========================================
	describe('GET /api/admin/requests', () => {
		const validSessionToken = 'valid-admin-session';

		beforeEach(async () => {
			// Create a valid admin session for each test
			const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
			await env.DB.prepare(`
				INSERT INTO admin_sessions (email, otp, otp_expires_at, session_token, session_expires_at)
				VALUES (?, ?, ?, ?, ?)
			`).bind('admin@cloudflare.com', '123456', new Date().toISOString(), validSessionToken, sessionExpiresAt).run();
		});

		it('should return all non-expired requests for authenticated admin', async () => {
			// Insert some test requests
			await env.DB.prepare(`
				INSERT INTO swag_requests (name, email, phone, address, status)
				VALUES (?, ?, ?, ?, ?)
			`).bind('John Doe', 'john@example.com', '+1 555 123 4567', '123 Main St', 'pending').run();

			await env.DB.prepare(`
				INSERT INTO swag_requests (name, email, phone, address, status)
				VALUES (?, ?, ?, ?, ?)
			`).bind('Jane Doe', 'jane@example.com', '+1 555 987 6543', '456 Oak Ave', 'approved').run();

			const request = createRequest('/api/admin/requests', {
				headers: { 'Cookie': `admin_session=${validSessionToken}` },
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const data = await response.json() as SwagRequestRow[];
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBe(2);
		});

		it('should return unauthorized for unauthenticated request', async () => {
			const request = createRequest('/api/admin/requests');

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
		});
	});

	describe('POST /api/admin/requests/:id/approve', () => {
		const validSessionToken = 'valid-admin-session';

		beforeEach(async () => {
			// Create a valid admin session
			const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
			await env.DB.prepare(`
				INSERT INTO admin_sessions (email, otp, otp_expires_at, session_token, session_expires_at)
				VALUES (?, ?, ?, ?, ?)
			`).bind('admin@cloudflare.com', '123456', new Date().toISOString(), validSessionToken, sessionExpiresAt).run();
		});

		it('should approve a pending request', async () => {
			// Insert a pending request
			await env.DB.prepare(`
				INSERT INTO swag_requests (name, email, phone, address, status)
				VALUES (?, ?, ?, ?, ?)
			`).bind('John Doe', 'john@example.com', '+1 555 123 4567', '123 Main Street, City, State, 12345', 'pending').run();

			const insertedRequest = await env.DB.prepare('SELECT id FROM swag_requests WHERE email = ?')
				.bind('john@example.com')
				.first<SwagRequestRow>();

			const request = createRequest(`/api/admin/requests/${insertedRequest?.id}/approve`, {
				method: 'POST',
				headers: { 'Cookie': `admin_session=${validSessionToken}` },
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const data = await response.json() as SuccessResponse;
			expect(data.success).toBe(true);

			// Verify status was updated
			const updatedRequest = await env.DB.prepare('SELECT status FROM swag_requests WHERE email = ?')
				.bind('john@example.com')
				.first<SwagRequestRow>();
			expect(updatedRequest?.status).toBe('approved');
		});

		it('should return 404 for non-existent request', async () => {
			const request = createRequest('/api/admin/requests/99999/approve', {
				method: 'POST',
				headers: { 'Cookie': `admin_session=${validSessionToken}` },
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(404);
		});

		it('should return unauthorized for unauthenticated request', async () => {
			const request = createRequest('/api/admin/requests/1/approve', {
				method: 'POST',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
		});
	});

	describe('DELETE /api/admin/requests/:id', () => {
		const validSessionToken = 'valid-admin-session';

		beforeEach(async () => {
			// Create a valid admin session
			const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
			await env.DB.prepare(`
				INSERT INTO admin_sessions (email, otp, otp_expires_at, session_token, session_expires_at)
				VALUES (?, ?, ?, ?, ?)
			`).bind('admin@cloudflare.com', '123456', new Date().toISOString(), validSessionToken, sessionExpiresAt).run();
		});

		it('should delete a request', async () => {
			// Insert a request
			await env.DB.prepare(`
				INSERT INTO swag_requests (name, email, phone, address)
				VALUES (?, ?, ?, ?)
			`).bind('John Doe', 'john@example.com', '+1 555 123 4567', '123 Main Street, City, State, 12345').run();

			const insertedRequest = await env.DB.prepare('SELECT id FROM swag_requests WHERE email = ?')
				.bind('john@example.com')
				.first<SwagRequestRow>();

			const request = createRequest(`/api/admin/requests/${insertedRequest?.id}`, {
				method: 'DELETE',
				headers: { 'Cookie': `admin_session=${validSessionToken}` },
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const data = await response.json() as SuccessResponse;
			expect(data.success).toBe(true);

			// Verify request was deleted
			const deletedRequest = await env.DB.prepare('SELECT * FROM swag_requests WHERE email = ?')
				.bind('john@example.com')
				.first();
			expect(deletedRequest).toBeNull();
		});

		it('should return 404 for non-existent request', async () => {
			const request = createRequest('/api/admin/requests/99999', {
				method: 'DELETE',
				headers: { 'Cookie': `admin_session=${validSessionToken}` },
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(404);
		});

		it('should return unauthorized for unauthenticated request', async () => {
			const request = createRequest('/api/admin/requests/1', {
				method: 'DELETE',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
		});
	});

	// ==========================================
	// CSV EXPORT TESTS
	// ==========================================
	describe('GET /api/admin/export-csv', () => {
		const validSessionToken = 'valid-admin-session';

		beforeEach(async () => {
			// Create a valid admin session
			const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
			await env.DB.prepare(`
				INSERT INTO admin_sessions (email, otp, otp_expires_at, session_token, session_expires_at)
				VALUES (?, ?, ?, ?, ?)
			`).bind('admin@cloudflare.com', '123456', new Date().toISOString(), validSessionToken, sessionExpiresAt).run();
		});

		it('should export approved requests as CSV', async () => {
			// Insert some approved requests
			await env.DB.prepare(`
				INSERT INTO swag_requests (name, email, phone, address, status)
				VALUES (?, ?, ?, ?, ?)
			`).bind('John Doe', 'john@example.com', '+1 555 123 4567', '123 Main St', 'approved').run();

			await env.DB.prepare(`
				INSERT INTO swag_requests (name, email, phone, address, status)
				VALUES (?, ?, ?, ?, ?)
			`).bind('Jane Doe', 'jane@example.com', '+1 555 987 6543', '456 Oak Ave', 'pending').run();

			const request = createRequest('/api/admin/export-csv', {
				headers: { 'Cookie': `admin_session=${validSessionToken}` },
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('text/csv');
			expect(response.headers.get('Content-Disposition')).toContain('attachment');

			const csv = await response.text();
			expect(csv).toContain('Name,Email,Phone,Address,Created At');
			expect(csv).toContain('John Doe');
			expect(csv).not.toContain('Jane Doe'); // Pending requests should not be included
		});

		it('should return empty CSV when no approved requests', async () => {
			// Insert only pending requests
			await env.DB.prepare(`
				INSERT INTO swag_requests (name, email, phone, address, status)
				VALUES (?, ?, ?, ?, ?)
			`).bind('Jane Doe', 'jane@example.com', '+1 555 987 6543', '456 Oak Ave', 'pending').run();

			const request = createRequest('/api/admin/export-csv', {
				headers: { 'Cookie': `admin_session=${validSessionToken}` },
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const csv = await response.text();
			// Should only have header row
			expect(csv.trim().split('\n').length).toBe(1);
		});

		it('should return unauthorized for unauthenticated request', async () => {
			const request = createRequest('/api/admin/export-csv');

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
		});
	});

	// ==========================================
	// API ROUTE HANDLING TESTS
	// ==========================================
	describe('API Route Handling', () => {
		it('should return 404 for unknown API routes', async () => {
			const request = createRequest('/api/unknown-route');

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(404);
		});

		it('should handle OPTIONS preflight requests', async () => {
			const request = createRequest('/api/swag-request', {
				method: 'OPTIONS',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
		});
	});

	// ==========================================
	// DATA TTL / EXPIRATION TESTS
	// ==========================================
	describe('Data TTL and Expiration', () => {
		it('should set expires_at to 30 days in the future', async () => {
			const request = createPostRequest('/api/swag-request', {
				name: 'John Doe',
				email: 'john@example.com',
				phone: '+1 555 123 4567',
				address: '123 Main Street, City, State, 12345, USA',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);

			const result = await env.DB.prepare('SELECT expires_at FROM swag_requests WHERE email = ?')
				.bind('john@example.com')
				.first<SwagRequestRow>();

			expect(result).toBeTruthy();
			const expiresAt = new Date(result!.expires_at!);
			const now = new Date();
			const daysDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
			
			// Should be approximately 30 days (allow some tolerance)
			expect(daysDiff).toBeGreaterThan(29.9);
			expect(daysDiff).toBeLessThan(30.1);
		});
	});

	// ==========================================
	// EDGE CASES AND ERROR HANDLING
	// ==========================================
	describe('Edge Cases and Error Handling', () => {
		it('should handle malformed JSON in request body', async () => {
			const request = createRequest('/api/swag-request', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: 'not valid json',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(500);
		});

		it('should handle empty request body', async () => {
			const request = createRequest('/api/swag-request', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: '{}',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
		});

		it('should trim whitespace from input fields', async () => {
			const request = createPostRequest('/api/swag-request', {
				name: '  John Doe  ',
				email: '  john@example.com  ',
				phone: '  +1 555 123 4567  ',
				address: '  123 Main Street, City, State, 12345, USA  ',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);

			const result = await env.DB.prepare('SELECT name, email FROM swag_requests WHERE email = ?')
				.bind('john@example.com')
				.first<SwagRequestRow>();

			expect(result?.name).toBe('John Doe');
			expect(result?.email).toBe('john@example.com');
		});
	});
});
