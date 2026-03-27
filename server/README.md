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

Database naming note
----------------------
The schema used by the server prefixes all persistent tables with `liquidate_`
(`liquidate_profiles`, `liquidate_activities`, `liquidate_expenses`, etc.). The
Express routes and SQL shipped in `server/routes/*` expect those prefixed names.

To make a gradual migration easier, `db/schema_neon.sql` includes optional
compatibility views that map the original unprefixed names to the prefixed
tables (for example `profiles` -> `liquidate_profiles`). These views are safe
to keep while you transition tooling or third-party scripts. If you prefer not
to create them, remove the view statements from the schema before applying it.

Example (views already included in `db/schema_neon.sql`):

```sql
-- create views (already present in schema_neon.sql)
create or replace view profiles as select * from liquidate_profiles;
-- drop when ready:
drop view if exists profiles, users, activities, activity_members, expenses, expense_splits, payments;
```
