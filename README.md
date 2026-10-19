# Gather — contact manager

A React/Vite interface backed by an Express API and MongoDB/Mongoose. Register or sign in to create, browse, search, filter, edit, and delete your own contacts. Includes field validation, unique email addresses per user, confirmation before deletion, and loading/error/empty states.

## Run locally

Requirements: Node.js 22 or newer, npm, and MongoDB running locally or a MongoDB Atlas connection string.

```powershell
npm install
Copy-Item .env.example .env
# Edit .env if using Atlas or a different MongoDB address.
npm run dev
```

Open http://localhost:5175. The API listens on port 4000; Vite proxies `/api` requests to it. The API waits for MongoDB and its unique email index before accepting requests. If startup fails, check the database address and connectivity.

```powershell
npm test
npm run build
```

`npm start` runs the API without watch mode. The frontend production build is in `client/dist`; serve it with a web server that proxies `/api` to Express. Configure `CLIENT_ORIGIN` for your frontend origin. Keep `.env` out of version control.

## API

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/contacts` | `{ contacts: [...] }` |
| GET | `/api/contacts/:id` | `{ contact: {...} }` |
| POST | `/api/contacts` | Creates a contact, 201 |
| PUT | `/api/contacts/:id` | Replaces editable fields |
| DELETE | `/api/contacts/:id` | Deletes a contact, 204 |
| GET | `/api/health` | Database readiness |
| POST | `/api/auth/register` | `{ name, email, password }`, creates account and signs in |
| POST | `/api/auth/login` | `{ email, password }`, signs in |
| GET | `/api/auth/me` | Current `{ user }`, or 401 |
| POST | `/api/auth/logout` | Ends session, 204 |

Contact fields: `firstName` (required), `lastName`, `email` (required, unique, case normalized), `phone`, `company`, `jobTitle`, `group` (`Work`, `Friends`, `Family`, `Other`), and `notes`. MongoDB supplies `_id`, `createdAt`, and `updatedAt`. PUT accepts a complete contact form; omitted optional fields become empty. Errors return `{ message, errors? }` with appropriate 400, 404, 409, 413, or 500 status codes.

Authentication uses salted scrypt password hashes and opaque sessions stored in MongoDB. Session cookies are HttpOnly, SameSite=Strict, expire after seven days, and use Secure when `NODE_ENV=production` (requires HTTPS). Login and registration are rate limited per client IP. Set `CLIENT_ORIGIN` to the exact frontend origin; cross-origin mutation requests are rejected. All contact endpoints require a session and restrict reads and writes to its user. Registration passwords require 12–128 characters. There is no password-reset or email-verification flow.

Existing contacts without an owner remain in MongoDB and are not shown to newly registered users. Startup replaces the legacy global email uniqueness index with a per-user index. It does not assign old records to an arbitrary new account.

For database integration tests, set `TEST_MONGODB_URI` to a dedicated test database before running `npm test`. Tests verify account creation, password hashing, login/logout, revoked sessions, contact persistence, duplicate-email rejection, and isolation between users; test records are removed afterward. Without that variable the MongoDB test is skipped; other HTTP and password tests still run.
