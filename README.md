# Cloudflare Swag Request

A Cloudflare Workers application that allows users to submit requests for Cloudflare swag. Features an admin dashboard for managing requests, OTP-based authentication for admins, and automatic data expiration for privacy compliance.

## Features

- **Swag Request Form** - Beautiful, mobile-responsive form for users to submit their details
- **Admin Dashboard** - Secure dashboard for Cloudflare employees to manage requests
- **OTP Authentication** - Email-based one-time password authentication (restricted to @cloudflare.com)
- **Request Management** - Approve, reject, or delete swag requests
- **Email Notifications** - Automatic email notifications when requests are approved
- **CSV Export** - Download approved requests as CSV for fulfillment
- **Privacy Compliance** - Automatic data deletion after 1 week (TTL)
- **Rate Limiting** - Maximum 10 requests per email address

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Email**: Resend API
- **Frontend**: HTML + Tailwind CSS
- **Testing**: Vitest with @cloudflare/vitest-pool-workers

## Project Structure

```
swag-request/
├── public/                     # Static assets
│   ├── index.html             # Landing page with swag request form
│   └── admin/
│       ├── login.html         # Admin login page
│       └── dashboard.html     # Admin dashboard
├── src/
│   ├── index.ts               # Main Worker entry point
│   └── db/
│       └── schema.sql         # Database schema reference
├── test/
│   └── index.test.ts          # Test suite (35 tests)
├── wrangler.jsonc             # Wrangler configuration
├── vitest.config.ts           # Vitest configuration
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- Cloudflare account
- Resend account (for email functionality)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd swag-request
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a D1 database:
   ```bash
   npx wrangler d1 create swag-requests-db
   ```

4. Update `wrangler.jsonc` with your database ID:
   ```jsonc
   {
     "d1_databases": [
       {
         "binding": "DB",
         "database_name": "swag-requests-db",
         "database_id": "<your-database-id>"
       }
     ]
   }
   ```

5. Set up your Resend API key:
   ```bash
   npx wrangler secret put RESEND_API_KEY
   ```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:8787`

### Testing

Run the test suite:
```bash
npm run test:run
```

Run tests in watch mode:
```bash
npm test
```

### Deployment

Deploy to Cloudflare Workers:
```bash
npm run deploy
```

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/swag-request` | Submit a new swag request |

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1 555 123 4567",
  "address": "123 Main St, City, State, 12345, USA"
}
```

### Admin Endpoints

All admin endpoints require authentication via session cookie.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/send-otp` | Send OTP to admin email |
| `POST` | `/api/admin/verify-otp` | Verify OTP and create session |
| `GET` | `/api/admin/check-auth` | Check authentication status |
| `POST` | `/api/admin/logout` | Logout and clear session |
| `GET` | `/api/admin/requests` | Get all swag requests |
| `POST` | `/api/admin/requests/:id/approve` | Approve a request |
| `DELETE` | `/api/admin/requests/:id` | Delete a request |
| `GET` | `/api/admin/export-csv` | Export approved requests as CSV |

## Database Schema

### swag_requests

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `name` | TEXT | Requester's full name |
| `email` | TEXT | Requester's email address |
| `phone` | TEXT | Requester's phone number |
| `address` | TEXT | Shipping address |
| `status` | TEXT | Request status: `pending`, `approved`, `rejected` |
| `created_at` | DATETIME | Timestamp of request creation |
| `expires_at` | DATETIME | Automatic expiration (7 days from creation) |

### admin_sessions

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `email` | TEXT | Admin email address |
| `otp` | TEXT | 6-digit one-time password |
| `session_token` | TEXT | Session token (set after OTP verification) |
| `otp_expires_at` | DATETIME | OTP expiration (10 minutes) |
| `session_expires_at` | DATETIME | Session expiration (24 hours) |
| `created_at` | DATETIME | Timestamp of session creation |

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | API key for Resend email service |

### Wrangler Configuration

The application uses the following bindings configured in `wrangler.jsonc`:

- **D1 Database**: `DB` - Stores swag requests and admin sessions
- **Assets**: Static files served from `./public`

## Validation Rules

### Swag Request Form

| Field | Validation |
|-------|------------|
| Name | Minimum 2 characters |
| Email | Valid email format |
| Phone | Minimum 7 characters, allows digits, spaces, +, -, (, ) |
| Address | Minimum 10 characters |

### Admin Login

- Only `@cloudflare.com` email addresses are allowed
- OTP expires after 10 minutes
- Sessions expire after 24 hours

## Security Features

1. **Email Domain Restriction** - Admin access restricted to @cloudflare.com emails
2. **OTP Authentication** - 6-digit one-time passwords for admin login
3. **HTTP-Only Cookies** - Session tokens stored in secure, HTTP-only cookies
4. **Automatic Expiration** - User data automatically deleted after 1 week
5. **Rate Limiting** - Maximum 10 requests per email address

## User Flow

### Requesting Swag

1. User visits the landing page
2. Fills out the form with name, email, phone, and shipping address
3. Form validates input on both client and server side
4. Success message confirms submission with privacy notice

### Admin Workflow

1. Admin clicks "Admin Login" on the landing page
2. Enters @cloudflare.com email address
3. Receives 6-digit OTP via email
4. Enters OTP to access the dashboard
5. Reviews pending requests
6. Approves or deletes requests
7. Approved users receive email notification
8. Exports approved requests as CSV for fulfillment

## Testing

The test suite includes 35 tests covering:

- **Swag Request Submission** (7 tests)
  - Valid submission
  - Invalid name, email, phone, address validation
  - 10 request limit enforcement
  - Email normalization

- **Admin OTP Authentication** (4 tests)
  - Valid @cloudflare.com email
  - Non-cloudflare.com rejection
  - Invalid email format
  - Email normalization

- **OTP Verification** (3 tests)
  - Valid OTP verification
  - Invalid OTP rejection
  - Expired OTP rejection

- **Admin Session Management** (4 tests)
  - Valid session authentication
  - Invalid session rejection
  - Missing session rejection
  - Logout functionality

- **Request Management** (9 tests)
  - Fetching requests
  - Approving requests
  - Deleting requests
  - Authorization checks

- **CSV Export** (3 tests)
  - Exporting approved requests
  - Empty export handling
  - Authorization check

- **API Route Handling** (2 tests)
  - 404 for unknown routes
  - CORS preflight handling

- **Data TTL** (1 test)
  - 7-day expiration validation

- **Edge Cases** (3 tests)
  - Malformed JSON handling
  - Empty request body
  - Whitespace trimming

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run deploy` | Deploy to Cloudflare Workers |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run cf-typegen` | Generate TypeScript types |

## License

This project is proprietary to Cloudflare, Inc.
