## Liquidate — Group Expense Tracker (Neon + Vercel)

This repository is a small group-expense tracker built with:

- Frontend: React + Vite + Tailwind CSS
- State: zustand (auth store)
- Backend: Neon/Postgres (schema in `db/schema_neon.sql`) with a thin Node service layer
- API hosting: file-based Vercel Functions under `api/` (shared business logic in `server/handlers/`)
- Auth: JWT (server issues tokens), password hashing with bcrypt

The project was migrated away from Supabase/PostgREST; the canonical DB schema is `db/schema_neon.sql` and is intended to be applied to a clean Postgres/Neon database.

Quick start (local development)

1) Install dependencies

```bash
npm install
```

2) Required environment variables

- `DATABASE_URL` — Postgres/Neon connection string used by the server and serverless functions
- `AUTH_JWT_SECRET` — a secret used to sign and verify JWTs (strongly recommended in production)

Set these in your shell or .env when running locally.

3) Initialize the database

- For a fresh database: run the SQL in `db/schema_neon.sql` (Neon SQL editor or psql). This file creates the tables (including `liquidate_users` with a `role` column defaulting to `'user'`), indexes, RLS policies, triggers, and compatibility views.

- If you're migrating an existing database you must alter existing tables manually. Example SQL to add the role column:

```sql
ALTER TABLE liquidate_users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';
UPDATE liquidate_users SET role = 'user' WHERE role IS NULL;
```

4) Run the frontend (Vite)

```bash
npm run dev
```

5) Server / serverless functions

- The project includes an Express server (`server/index.js`) for local, long-running API use (script: `npm run server`).
- The preferred deployment surface is Vercel file-based functions located in `api/`. During local serverless development use `vercel dev` (install Vercel CLI) or run the Express server directly.

Notes about auth and admin

- Authentication: login/register endpoints are implemented under `/api/auth/*`. The client stores the JWT in `localStorage` under the key `auth_token` and sends it in the Authorization header.
- Roles: `liquidate_users.role` exists and defaults to `'user'`. A `super_admin` role is supported. The frontend `Header` shows a `Users` admin link only when the current user's `role` is `super_admin`.
- Admin UI: there is a minimal Users admin page at `src/pages/Users.jsx` that calls `/api/admin/users` (GET) and `/api/admin/users/:id` (PUT) to list and edit users. Server-side endpoints check the DB to confirm the requester is `super_admin`.

Files & structure (high-level)

- `db/schema_neon.sql` — canonical DB schema for Neon/Postgres (run on a clean DB)
- `server/` — shared business logic and DB helpers
	- `server/db.js` — pg Pool wrapper (reads `DATABASE_URL`)
	- `server/handlers/` — business-logic functions used by both Express routes and serverless functions
	- `server/middleware/auth.js` — token parsing / Express middleware
- `api/` — Vercel function handlers that call the `server/handlers/*` logic
- `src/` — React app
	- `src/services/api.js` — fetch-based client-side API wrapper (talks to `/api/*`)
	- `src/stores/useAuthStore.js` — zustand auth store
	- `src/components/Header.jsx` — navigation (shows Users link to super_admin)
	- `src/pages/Users.jsx` — admin page for listing/editing users

Security & deployment notes

- Set `AUTH_JWT_SECRET` in production. The code will decode tokens without verification if the secret is missing (development convenience) — don't rely on this in production.
- The DB schema includes RLS policies that expect session variables `app.current_user_id` and `app.current_user_role` when RLS is used. Handlers currently enforce authorization at the application layer; if you want DB-enforced RLS set these session vars per-connection before executing queries.
- For Vercel deployment, configure `DATABASE_URL` and `AUTH_JWT_SECRET` in Vercel environment variables.

Where to look next

- Start with `db/schema_neon.sql` (apply it to a fresh DB) and `server/index.js`/`api/` for the API surface.
- The frontend expects JWTs returned from `/api/auth/login` and `/api/auth/me` and will store tokens in `localStorage` as `auth_token`.

If you want, I can:
- Add a small migration runner to manage schema changes over time.
- Add more robust admin UX (search/pagination/validation) for the Users page.
- Wire database session vars for RLS enforcement in serverless handlers.

License: MIT
