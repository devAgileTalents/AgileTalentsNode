# Agile Talents API Server — Documentation

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Getting Started](#getting-started)
4. [Environment Variables](#environment-variables)
5. [Architecture](#architecture)
6. [Domain Routing](#domain-routing)
7. [Authentication](#authentication)
8. [API Reference — Public Resources](#api-reference--public-resources)
9. [API Reference — Hub (Authenticated)](#api-reference--hub-authenticated)
10. [Database Schema](#database-schema)
11. [Security & Rate Limiting](#security--rate-limiting)
12. [Deployment](#deployment)
13. [Project Structure](#project-structure)

---

## Overview

The Agile Talents API Server is a Node.js/Express backend that powers the Agile Talents platform. It serves two main purposes:

- **Public API** (`api.agiletalents.io`) — exposes CRUD endpoints for freelancers, reviews, and blog articles.
- **Hub API** (`api.agiletalents.io/hub/...`) — a protected area for managing users, projects, logged hours, and invoices. All hub routes require cookie-based authentication.
- **Media Server** (`media.agiletalents.io`) — serves static assets (images, logos, photos) from the `uploads/` directory.

The server uses PostgreSQL as its database and is deployed to a VPS via GitHub Actions + PM2.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js |
| Language | TypeScript |
| Framework | Express 5 |
| Database | PostgreSQL (via `pg`) |
| Auth | HMAC-signed cookies + bcrypt |
| Security | Helmet, CORS, rate limiting |
| Process Manager | PM2 |
| CI/CD | GitHub Actions |

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL database
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/devAgileTalents/AgileTalentsNode.git
cd AgileTalentsNode

# Install dependencies
npm install

# Create a .env file (see Environment Variables section)
cp .env.example .env

# Run database migrations
psql -U <user> -d <database> -f scripts/001_create_hub_tables.sql
psql -U <user> -d <database> -f scripts/002_seed_hub_data.sql
psql -U <user> -d <database> -f scripts/003_add_password_hash.sql
```

### Running

```bash
# Development (with hot-reload via nodemon)
npm run dev

# Production build
npm run build
npm start
```

The server starts on port `4000` by default (configurable via `PORT` env variable) and binds to `0.0.0.0`.

---

## Environment Variables

Create a `.env` file in the project root with the following variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `4000` |
| `HOST` | Bind address | `0.0.0.0` |
| `NODE_ENV` | Environment (`development` / `production`) | `development` |
| `DB_USER` | PostgreSQL username | — |
| `DB_HOST` | PostgreSQL host | — |
| `DB_NAME` | PostgreSQL database name | — |
| `DB_PASSWORD` | PostgreSQL password | — |
| `DB_PORT` | PostgreSQL port | `5432` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | `http://localhost:3000,http://localhost:4000` |
| `ADMIN_USERNAME` | Admin panel login username | — |
| `ADMIN_PASSWORD_HASH` | Bcrypt hash of admin password | — |
| `ADMIN_SESSION_SECRET` | Secret for signing admin session tokens | — |
| `HUB_SESSION_SECRET` | Secret for signing hub user session tokens | — |
| `DEV_IPS` | Comma-separated IPs exempt from rate limiting | — |
| `DISABLE_RATE_LIMIT` | Set to `true` to disable all rate limiting | — |

---

## Architecture

The application follows a layered architecture:

```
Request → Middleware → Routes → Repository → PostgreSQL
```

- **Middleware layer** — cookie parsing, Helmet security headers, compression, CORS, rate limiting, suspicious request detection, request logging.
- **Route layer** — defines HTTP endpoints and delegates to repositories. Includes domain guards (`onlyApiDomain`, `onlyMediaDomain`) and authentication middleware (`requireAdmin`, `requireHubAuth`).
- **Repository layer** — encapsulates all database queries. Each repository handles a single entity type, transforms DB rows (snake_case) into API responses (camelCase), and uses parameterized queries.
- **CRUD Router factory** — a generic `createCrudRouter()` function that generates standard list/get/create/update/delete routes from a repository, with built-in pagination validation and customizable query parsing.

---

## Domain Routing

The server is designed to run behind nginx, which routes traffic from two subdomains to the same Node process:

| Domain | Purpose | Access |
|--------|---------|--------|
| `api.agiletalents.io` | API endpoints (`/freelancers`, `/reviews`, `/blog-articles`, `/hub/*`, `/health`) | Restricted by `onlyApiDomain` middleware |
| `media.agiletalents.io` | Static file serving (`/uploads/*`) | Restricted by `onlyMediaDomain` middleware |

If a request reaches the wrong domain (e.g., trying to access `/uploads` through the API domain), the server returns `403 Forbidden`.

---

## Authentication

The server has two independent authentication systems, both using HMAC-signed cookies.

### Token Mechanism

All tokens follow the same format: `payload.hmac_signature`, where the signature is an SHA-256 HMAC of the payload using the respective secret. No third-party JWT library is used.

### Admin Authentication

Used for the admin panel. Tokens have no expiration (valid until cookie expires — 7 days).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/auth/login` | POST | Authenticate with `login` and `password`. Sets `admin_session` cookie. |
| `/admin/auth/logout` | POST | Clears the `admin_session` cookie. |
| `/admin/auth/me` | GET | Returns `{ ok: true/false }` indicating session validity. |

**Request body for login:**
```json
{
  "login": "admin_username",
  "password": "admin_password"
}
```

### Hub Authentication

Used by hub users (freelancers, clients). Tokens expire after 24 hours.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/hub/auth/login` | POST | Authenticate with `email` and `password`. Sets `hub_session` cookie. Returns user profile. |
| `/hub/auth/logout` | POST | Clears the `hub_session` cookie. |
| `/hub/auth/me` | GET | Returns current user profile. Updates `last_seen` and activates user if previously "Last been". |

**Request body for login:**
```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

**Successful login response:**
```json
{
  "ok": true,
  "user": {
    "id": "1",
    "email": "user@example.com",
    "photo": "https://...",
    "name": "John Doe",
    "role": "Freelancer"
  }
}
```

On first login, users with `Invited` status are automatically changed to `Active`.

### Cookie Settings

Both auth systems use httpOnly cookies. In production (or when `x-forwarded-proto: https` is detected), cookies are set with `secure: true` and `sameSite: none`. In development, `sameSite: lax` is used.

---

## API Reference — Public Resources

All public CRUD endpoints share the same response structure, powered by the `createCrudRouter()` factory.

### Common Pagination

All list endpoints support pagination via query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | `1` | Page number (starts at 1) |
| `limit` | number | `10` | Items per page (max 100) |

**Paginated response format:**
```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

---

### Freelancers — `/freelancers`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/freelancers` | List freelancers (paginated, filterable) |
| GET | `/freelancers/:id` | Get a single freelancer |
| POST | `/freelancers` | Create a freelancer |
| PUT | `/freelancers/:id` | Update a freelancer |
| DELETE | `/freelancers/:id` | Delete a freelancer |

**Filter query parameters (GET list):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Full-text search across name, profession, and technologies |
| `name` | string | Filter by name (partial match) |
| `profession` | string | Filter by profession (partial match) |
| `tech` | string | Filter by technology (partial match) |
| `minRate` | number | Minimum hourly rate |
| `maxRate` | number | Maximum hourly rate |
| `minExp` | number | Minimum years of experience |

**Freelancer object:**
```json
{
  "id": 1,
  "imageUrl": "/freelancers/freelancer1.jpg",
  "fullName": "Jane Smith",
  "profession": "Full-Stack Developer",
  "hourlyRate": 85,
  "experience": 7,
  "technologies": ["React", "Node.js", "TypeScript"]
}
```

**Create/Update body** uses the same camelCase fields (without `id`).

---

### Reviews — `/reviews`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/reviews` | List reviews (paginated, filterable) |
| GET | `/reviews/:id` | Get a single review |
| POST | `/reviews` | Create a review |
| PUT | `/reviews/:id` | Update a review |
| DELETE | `/reviews/:id` | Delete a review |

**Filter query parameters (GET list):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search across review text, reviewer name, and profession |
| `rating` | number | Exact rating match |
| `reviewer` | string | Filter by reviewer name or profession (partial match) |
| `text` | string | Filter by review text (partial match) |

**Review object:**
```json
{
  "id": 1,
  "rating": 5,
  "reviewerCompanyLogo": "/logos/company.png",
  "reviewText": "Great experience working with Agile Talents.",
  "reviewerPhoto": "/reviews/reviewer.jpg",
  "reviewerFullName": "Tom Michels",
  "reviewerProfession": "CTO at Company",
  "reviewTrustPilotLink": "https://trustpilot.com/..."
}
```

---

### Blog Articles — `/blog-articles`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/blog-articles` | List articles (paginated, filterable) |
| GET | `/blog-articles/:id` | Get a single article |
| POST | `/blog-articles` | Create an article |
| PUT | `/blog-articles/:id` | Update an article |
| DELETE | `/blog-articles/:id` | Delete an article |

**Filter query parameters (GET list):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search across title, description, and author name |
| `title` | string | Filter by title (partial match) |
| `author` | string | Filter by author name (partial match) |
| `fromDate` | string | Articles published on or after this date (ISO format, e.g. `2025-01-01`) |
| `toDate` | string | Articles published on or before this date |

**Blog article object:**
```json
{
  "id": 1,
  "imageArticleHref": "/blog/articleImage1.jpg",
  "title": "How to Hire Remote Developers",
  "description": "A guide to building distributed teams...",
  "photoAuthorHref": "/blog/authorPhoto1.jpg",
  "authorFullName": "Alice Johnson",
  "publishDate": "15 March 2025"
}
```

---

## API Reference — Hub (Authenticated)

All hub data routes are prefixed with `/hub/data` and require a valid `hub_session` cookie. Unauthenticated requests receive a `401 Unauthorized` response.

### Users — `/hub/data/users`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hub/data/users` | List users (paginated, default limit: 100) |
| GET | `/hub/data/users/all` | List all users without pagination (for dropdowns) |
| GET | `/hub/data/users/:id` | Get user by ID (includes related data) |
| POST | `/hub/data/users` | Create a new user |
| PUT | `/hub/data/users/:id` | Update a user |
| DELETE | `/hub/data/users/:id` | Delete a user |

**Filter query parameters (GET paginated list):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search across name, email, and title |
| `role` | string | Exact role match |
| `status` | string | Exact status match |

**User response object:**
```json
{
  "id": 1,
  "name": "John Doe",
  "photo": "https://...",
  "title": "Senior Developer",
  "company": "Acme Corp",
  "hourlyRate": 90,
  "role": "Freelancer",
  "email": "john@example.com",
  "invoiceEmail": "billing@john.com",
  "status": "Active",
  "lastSeen": "2025-06-01T12:00:00.000Z",
  "loggedHours": [ ... ],
  "additionalCosts": [ ... ],
  "invoices": [ ... ],
  "projectRates": [
    { "projectId": 1, "hourlyRate": 95 }
  ],
  "address": {
    "streetAddress": "123 Main St",
    "city": "Berlin",
    "postalCode": "10115",
    "region": "Berlin",
    "country": "Germany"
  },
  "bankingInfo": {
    "accountHolderName": "John Doe",
    "bankName": "Deutsche Bank",
    "iban": "DE89...",
    "swift": "DEUTDEFF",
    "currency": "EUR",
    "paymentMethod": "Bank Transfer"
  },
  "legalInfo": {
    "legalName": "John Doe Consulting",
    "vatId": "DE123456789",
    "taxId": "12/345/67890"
  }
}
```

**Create body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "role": "Freelancer",
  "title": "Designer",
  "photo": null,
  "company": null,
  "hourlyRate": 75,
  "invoiceEmail": null,
  "status": "Invited"
}
```

**Update body** — supports flat fields and nested objects. All fields are optional:
```json
{
  "name": "Jane Smith Updated",
  "hourlyRate": 80,
  "address": {
    "city": "Munich",
    "country": "Germany"
  },
  "bankingInfo": {
    "iban": "DE89...",
    "swift": "COBADEFF"
  },
  "legalInfo": {
    "vatId": "DE999999999"
  }
}
```

---

### Projects — `/hub/data/projects`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hub/data/projects` | List projects (paginated, default limit: 100) |
| GET | `/hub/data/projects/all` | List all projects without pagination |
| GET | `/hub/data/projects/:id` | Get project by ID |
| POST | `/hub/data/projects` | Create a new project |
| PUT | `/hub/data/projects/:id` | Update a project |
| DELETE | `/hub/data/projects/:id` | Delete a project |

**Filter query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search across name and title |
| `clientId` | number | Filter by client user ID |

**Project response object:**
```json
{
  "id": 1,
  "name": "Website Redesign",
  "clientId": 5,
  "title": "Full redesign of corporate website",
  "startDate": "2025-01-15",
  "endDate": "2025-06-30",
  "weeklyTarget": 40,
  "contractedType": "Full-time",
  "contractedHours": null,
  "access": [1, 3, 7]
}
```

The `access` array contains user IDs that have access to this project. When creating or updating a project, pass an `access` array to set which users can access it — existing access entries are replaced entirely on update.

---

### Logged Hours — `/hub/data/logged-hours`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hub/data/logged-hours/:userId` | Get all logged hours for a user |
| POST | `/hub/data/logged-hours/:userId` | Log hours for a user |
| PUT | `/hub/data/logged-hours/entry/:id` | Update a logged hour entry |
| DELETE | `/hub/data/logged-hours/entry/:id` | Delete a logged hour entry |

**Logged hour object:**
```json
{
  "id": 1,
  "date": "2025-03-15",
  "hours": 8,
  "task": "Frontend development",
  "projectId": 2
}
```

**Create body (POST):**
```json
{
  "projectId": 2,
  "date": "2025-03-15",
  "hours": 8,
  "task": "Frontend development"
}
```

---

### Invoices — `/hub/data/invoices`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hub/data/invoices/:userId` | Get all invoices for a user |
| POST | `/hub/data/invoices/:userId` | Create an invoice for a user |
| DELETE | `/hub/data/invoices/entry/:id` | Delete an invoice |

**Invoice object:**
```json
{
  "id": 1,
  "projectId": 2,
  "month": "2025-03",
  "generatedAt": "2025-04-01T10:00:00.000Z",
  "hours": 160,
  "hourlyRate": 85,
  "additionalCost": 200,
  "total": 13800
}
```

**Create body (POST):**
```json
{
  "projectId": 2,
  "month": "2025-03",
  "hours": 160,
  "hourlyRate": 85,
  "additionalCost": 200,
  "total": 13800,
  "generatedAt": "2025-04-01T10:00:00.000Z"
}
```

If `generatedAt` is omitted, the current timestamp is used.

---

## Health Check

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Returns server status, uptime, and current timestamp |

**Response:**
```json
{
  "status": "OK",
  "uptime": 86400.123,
  "timestamp": "2025-06-01T12:00:00.000Z"
}
```

This endpoint is exempt from rate limiting.

---

## Database Schema

The server uses the following PostgreSQL tables:

### Public Content Tables

- **`freelancers`** — freelancer profiles displayed on the website (name, profession, hourly rate, experience, technologies array).
- **`reviews`** — client testimonials with Trustpilot links.
- **`blog_articles`** — blog posts with author info and publish dates.

### Hub Tables

- **`hub_users`** — full user profiles including address, banking, and legal information. Also stores `password_hash` for authentication and `status` / `last_seen` for presence tracking.
- **`hub_projects`** — project definitions with client reference, date range, weekly target hours, and contract type.
- **`hub_project_access`** — many-to-many join table controlling which users can access which projects.
- **`hub_logged_hours`** — time entries linked to a user and a project.
- **`hub_additional_costs`** — extra costs per user/project/month.
- **`hub_invoices`** — generated invoice records with hours, rates, and totals.
- **`hub_project_rates`** — per-project hourly rate overrides for individual users.

### User Statuses

| Status | Description |
|--------|-------------|
| `Invited` | User created but hasn't logged in yet. Transitions to `Active` on first login. |
| `Active` | User is currently active. Set on login and `/me` calls. |
| `Last been` | User was previously active but hasn't been seen recently. Transitions to `Active` on `/me`. |
| `Disabled` | Administratively disabled. Not changed by login activity. |
| `Archived` | Archived user. Not changed by login activity. |

---

## Security & Rate Limiting

### Middleware Stack (applied in order)

1. **Cookie Parser** — parses cookies for session management.
2. **Helmet** — sets security headers (CSP, HSTS, X-Frame-Options, etc.) with cross-origin resource policy set to `cross-origin` for media serving.
3. **Compression** — gzip/brotli response compression.
4. **General Rate Limiter** — 200 requests per 15 minutes per IP. Skips `/health`, `/uploads`, and whitelisted IPs.
5. **Suspicious Request Detector** — blocks known attack patterns (path traversal, config file access, admin panels, phpMyAdmin, etc.). Triggers a stricter rate limit of 5 requests per hour.
6. **Request Logger** — logs method, path, status code, and response time for every request.
7. **CORS** — validates origin against `ALLOWED_ORIGINS`. Supports credentials.

### Rate Limit Exemptions

Rate limiting is skipped for:

- Hub-authenticated routes (paths starting with `/hub/`, `/auth/`, or `/data/`)
- Requests with a valid `hub_session` cookie
- Requests forwarded from `api.agiletalents.io` (via `x-forwarded-host` header)
- IPs listed in the `DEV_IPS` environment variable
- Localhost / loopback addresses
- When `DISABLE_RATE_LIMIT=true` is set

### Login Rate Limiting

Both admin and hub login endpoints have an additional limiter: 10 attempts per 15 minutes per IP.

### Request Size Limits

JSON and URL-encoded bodies are limited to 10 MB.

---

## Deployment

### CI/CD Pipeline

The project uses GitHub Actions for automated deployment. On every push to the `master` branch:

1. SSH into the VPS using credentials stored in GitHub Secrets.
2. Pull the latest code (`git fetch origin && git reset --hard origin/master`).
3. Install dependencies (`npm install`).
4. Build TypeScript (`npm run build`).
5. Restart the PM2 process (`pm2 startOrRestart ecosystem.config.js`).

### PM2 Configuration

The PM2 process is configured via `ecosystem.config.js`:

- Process name: `node-server-agile-talents`
- Working directory: `/var/www/AgileTalentsNode`
- Single fork instance
- Auto-restart enabled
- Memory limit: 1 GB
- Logs stored in `./logs/`

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `VPS_HOST` | VPS IP address or hostname |
| `VPS_USERNAME` | SSH username |
| `VPS_SSH_KEY` | Private SSH key for authentication |

---

## Project Structure

```
├── .github/workflows/
│   └── deploy.yml              # CI/CD pipeline
├── scripts/
│   ├── 001_create_hub_tables.sql  # Hub schema migration
│   ├── 002_seed_hub_data.sql      # Initial seed data
│   └── 003_add_password_hash.sql  # Add password column
├── src/
│   ├── api/
│   │   └── crudRouter.ts       # Generic CRUD router factory
│   ├── db/
│   │   ├── index.ts            # PostgreSQL connection pool
│   │   └── repositories/
│   │       ├── blog-articles.ts
│   │       ├── freelancers.ts
│   │       ├── hub-invoices.ts
│   │       ├── hub-logged-hours.ts
│   │       ├── hub-projects.ts
│   │       ├── hub-users.ts
│   │       └── reviews.ts
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── admin-session.ts   # Admin token build/verify
│   │   │   ├── hub-session.ts     # Hub token build/verify
│   │   │   └── signed-token.ts    # HMAC signing primitives
│   │   ├── errors/
│   │   │   ├── repository-error.ts
│   │   │   └── route-error.ts
│   │   ├── helpers/
│   │   │   └── getPublicHubUser.ts
│   │   └── http/
│   │       └── cookie.ts         # HTTPS detection
│   ├── routes/
│   │   ├── auth.admin.routes.ts  # Admin auth endpoints
│   │   ├── auth.hub.routes.ts    # Hub auth endpoints
│   │   ├── hub.data.routes.ts    # Hub CRUD endpoints
│   │   └── public.routes.ts      # Public API router
│   ├── types/
│   │   ├── db.types.ts           # Database row types
│   │   ├── express.d.ts          # Express type extensions
│   │   └── types.ts              # API response types
│   ├── app.ts                    # Express app config
│   └── server.ts                 # Entry point
├── uploads/                      # Static media assets
├── ecosystem.config.js           # PM2 config
├── package.json
└── tsconfig.json
```

---

## Error Responses

All error responses follow a consistent format:

```json
{
  "error": "Error Type",
  "message": "Human-readable description"
}
```

| Status | Meaning |
|--------|---------|
| `400` | Bad Request — invalid ID, pagination params, or missing required fields |
| `401` | Unauthorized — missing or invalid session cookie |
| `403` | Forbidden — wrong domain or CORS violation |
| `404` | Not Found — resource or route doesn't exist |
| `429` | Too Many Requests — rate limit exceeded |
| `500` | Internal Server Error — unexpected failure (details hidden in production) |

In development mode (`NODE_ENV=development`), 500 errors include the original error message. In production, a generic message is returned.
