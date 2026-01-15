# Cloudflare Swag Request

A Cloudflare Workers application for managing swag requests with admin dashboard, OTP authentication, and automatic data expiration.

## Features

- User swag request form with promo code support
- Admin dashboard with search, filtering, date range, and pagination
- OTP authentication (restricted to @cloudflare.com)
- Email notifications via Resend
- CSV export for fulfillment
- Auto data deletion after 30 days
- Rate limiting and CSRF protection

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Create D1 database
```bash
npx wrangler d1 create swag-requests-db
```

### 3. Update `wrangler.jsonc` with your database ID
```jsonc
"d1_databases": [{
  "binding": "DB",
  "database_name": "swag-requests-db",
  "database_id": "<your-database-id>"
}]
```

### 4. Create `.env` file
```env
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=noreply@yourdomain.com
ALLOWED_ORIGINS=https://your-app.pages.dev,https://yourdomain.com
```

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key for sending emails |
| `FROM_EMAIL` | Sender email address |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins |

### 5. Set production secrets
```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put FROM_EMAIL
npx wrangler secret put ALLOWED_ORIGINS
```

### 6. Run locally
```bash
npm run dev
```

### 7. Deploy
```bash
npm run deploy
```

<details>
<summary><b>API Endpoints</b></summary>

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/swag-request` | Submit swag request |

### Admin (requires auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/send-otp` | Send OTP |
| `POST` | `/api/admin/verify-otp` | Verify OTP |
| `GET` | `/api/admin/check-auth` | Check auth status |
| `POST` | `/api/admin/logout` | Logout |
| `GET` | `/api/admin/requests` | List requests |
| `POST` | `/api/admin/requests/:id/approve` | Approve request |
| `DELETE` | `/api/admin/requests/:id` | Delete request |
| `GET` | `/api/admin/export-csv` | Export CSV |

</details>

<details>
<summary><b>Database Schema</b></summary>

### swag_requests
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `name` | TEXT | Full name |
| `email` | TEXT | Email address |
| `phone` | TEXT | Phone number |
| `address` | TEXT | Shipping address |
| `promo_code` | TEXT | Optional promo code |
| `status` | TEXT | `pending`, `approved`, `rejected` |
| `created_at` | DATETIME | Created timestamp |
| `expires_at` | DATETIME | Expires after 30 days |

### admin_sessions
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `email` | TEXT | Admin email |
| `otp` | TEXT | 6-digit OTP |
| `session_token` | TEXT | Session token |
| `otp_expires_at` | DATETIME | OTP expires in 10 min |
| `session_expires_at` | DATETIME | Session expires in 24 hrs |

</details>

<details>
<summary><b>Validation Rules</b></summary>

### Swag Request
| Field | Rules |
|-------|-------|
| Name | 2-100 characters |
| Email | Valid email, max 254 chars |
| Phone | Valid phone, max 30 chars |
| Address | 10-500 characters |
| Promo Code | Optional, max 50 chars |

### Admin Login
- Only `@cloudflare.com` emails allowed
- Max 5 OTP requests per hour
- Max 5 verification attempts per 15 min
- OTP expires in 10 minutes
- Session expires in 24 hours

</details>

<details>
<summary><b>Security Features</b></summary>

- Cryptographically secure OTP generation
- Rate limiting on auth endpoints
- CSRF protection via Origin validation
- Secure, HttpOnly, SameSite cookies
- Input validation with length limits (validator.js)
- XSS prevention via output escaping
- Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- Request size limits (10KB max)
- Restrictive CORS policy

</details>

<details>
<summary><b>Project Structure</b></summary>

```
swag-request/
├── public/
│   ├── index.html              # Request form
│   └── admin/
│       ├── login.html          # Admin login
│       └── dashboard.html      # Admin dashboard
├── src/
│   ├── index.ts                # Worker entry
│   ├── types.ts                # TypeScript types
│   ├── handlers/
│   │   ├── swag.ts             # Swag request handler
│   │   └── admin.ts            # Admin handlers
│   ├── db/
│   │   ├── index.ts            # DB init & cleanup
│   │   └── schema.sql          # Schema reference
│   └── utils/
│       ├── validation.ts       # Input validation
│       ├── crypto.ts           # OTP & token generation
│       ├── session.ts          # Session management
│       ├── email.ts            # Email sending
│       └── response.ts         # Response helpers
├── test/
│   └── index.test.ts           # Test suite (39 tests)
├── wrangler.jsonc
└── package.json
```

</details>

<details>
<summary><b>Scripts</b></summary>

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server |
| `npm run deploy` | Deploy to Workers |
| `npm test` | Run tests (watch) |
| `npm run test:run` | Run tests once |
| `npm run cf-typegen` | Generate types |

</details>

## License

Proprietary - Cloudflare, Inc.
