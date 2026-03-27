# Server (Express + Neon/Postgres)

This folder contains a small Express API that can run against a Neon or Postgres database.

Environment
- DATABASE_URL: Postgres connection string (Neon). Example: postgresql://user:pass@host/dbname
- AUTH_JWT_SECRET (optional but recommended): JWT secret or public key used to verify incoming Bearer tokens. If not set, the server will decode tokens without verification (development only).

Available routes
- GET /ping - simple ping
- GET /health - DB health check
- Activities:
  - GET /api/activities/:id
  - PUT /api/activities/:id (requires Authorization)
- Expenses:
  - POST /api/expenses (requires Authorization)
  - PUT /api/expenses/:id (requires Authorization)
  - DELETE /api/expenses/:id (requires Authorization)
  - GET /api/activities/:id/expenses (from activities router)
- Members:
  - POST /api/members (requires Authorization)
  - DELETE /api/members (requires Authorization)
- Payments:
  - GET /api/payments?user_id=... 
  - POST /api/payments (requires Authorization)

Run locally
1. Install dependencies in the project root:

```bash
npm install
```

2. Start the server (example):

```bash
DATABASE_URL="postgresql://<user>:<pass>@<host>/<db>?sslmode=require" npm run server
```

Notes
- For production, set `AUTH_JWT_SECRET` to the secret/public key used to sign JWTs and use HTTPS.
- The server implements basic JWT middleware at `server/middleware/auth.js`. It will verify tokens if `AUTH_JWT_SECRET` is set; otherwise it will decode tokens without verification (dev convenience).
- Endpoints currently do not perform fine-grained authorization (e.g., verify that the authenticated user is a member of the activity). Add checks in the routes to enforce access controls as needed.
