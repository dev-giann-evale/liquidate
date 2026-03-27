# Migration plan: Supabase -> Neon

This document outlines a recommended, incremental migration plan from Supabase (PostgREST + Auth + RLS) to a Neon serverless Postgres backend with an Express.js API.

Goals
- Preserve data integrity and minimize downtime.
- Keep frontend changes incremental by preserving JSON response shapes where practical.
- Replace Supabase-only constructs (auth.uid(), policies) with server-side authorization or adapted RLS.

Phases

1) Discovery & Inventory
- Export current `supabase/schema.sql` and review for Supabase-specific functions/triggers (auth.uid(), RLS policies that reference auth.role() or auth.uid()).
- List all frontend `src/services/api.js` functions that call Supabase and categorize: read-only (easy), write (need server endpoints + auth), RPCs.

2) Prepare server scaffolding (already partially done)
- Add `server/` with `db.js`, route modules, and `server/index.js`.
- Ensure `DATABASE_URL` env var is used and `pg` Pool configuration supports Neon.
- Add basic health endpoints.

3) Implement read-only endpoints
- Implement endpoints that mirror PostgREST JSON shapes for: activities, activity expenses (with nested splits), activity members, profiles, payments.
- Update frontend service layer to try server endpoints first, falling back to Supabase (incremental cutover).
- Smoke test frontend fetching flows.

4) Decide auth strategy
- Options:
  - Keep Supabase Auth for identity and validate Supabase JWTs on the Express server.
  - Use a dedicated auth provider (Auth0, Clerk, or similar) and issue server-side JWTs.
  - Self-hosted: implement username/password with password hashing (less recommended).
- Deliverable: pick one and implement middleware for Express to validate JWTs and set req.user.

5) Implement write endpoints with authorization
- Add server endpoints for create/update/delete for activities, expenses, expense_splits, activity_members, and payments.
- Ensure endpoints validate `req.user` and enforce the same business rules previously enforced by RLS.
- Optionally, for a short period, keep RLS policies in the DB and use `session variables` or `SET LOCAL` with `pg` to pass the authenticated user id to queries.

6) Data migration
- Export schema and data from Supabase:
  - Use `pg_dump --schema-only` and `pg_dump --data-only` or Supabase SQL export UI.
  - Create `supabase/schema_neon.sql` with modifications (remove `auth.uid()` uses; adapt triggers/functions that rely on Supabase auth).
- Import into Neon using `psql`/neon CLI.
- Verify sequences, constraints, functions, extensions (e.g., `uuid-ossp`), and indexes.

7) Testing & verification
- Add integration tests for server routes using `supertest`.
- Run end-to-end manual tests: create activity, add expense, create splits, record payment, edit expense, remove member.
- Compare results with Supabase environment.

8) Cutover & cleanup
- Switch production env variables to point to Neon DB and start Express server behind a stable domain.
- Monitor logs and metrics.
- Remove Supabase-specific code and RLS if moving all authorization to server.

9) Rollback plan
- Keep Supabase instance for 24-48h with read-only access to revert quickly.
- Maintain DB backups (daily snapshots) before cutover.

Notes and caveats
- Supabase RLS and functions referencing `auth.uid()` are a different model than app-mediated auth. If you rely on RLS for security, you'll need to either: (A) keep RLS in Neon and set session variables from your server (recommended for parity), or (B) implement all access control in Express middleware and database functions.
- Keep response shapes stable so frontend changes can be staged.
- Migrate secrets carefully — do not commit `DATABASE_URL` or service_role keys.

Checklist (short)
- [ ] Inventory and export schema
- [ ] Implement read endpoints and adjust frontend fetches
- [ ] Choose auth strategy and implement JWT validation
- [ ] Implement write endpoints
- [ ] Export/import data and verify
- [ ] Run integration tests
- [ ] Cutover and monitor

Deliverables
- `supabase/schema_neon.sql` (schema adapted for Neon)
- `server/` endpoints for read/write
- `MIGRATION_TO_NEON.md` (this file)
- `server/README.md` with run instructions
- Updated `src/services/api.js` with staged fallbacks

If you'd like, I can now:
- Generate `supabase/schema_neon.sql` by reading `supabase/schema.sql` and applying needed edits, or
- Start implementing more server endpoints (create/update expense, member management), or
- Update the frontend to call server endpoints for more read APIs.

Choose the next step and I'll execute it.
