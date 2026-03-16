# Liquidate — Group Expense Tracker

This is a Vite + React frontend scaffold and Supabase backend schema for a Group Expense Tracker (mobile-first, TailwindCSS).

Quick setup

1. Install dependencies:

```bash
npm install
```

2. Create a Supabase project and get URL and anon key. Set env vars in `.env` or your shell:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

3. Apply the DB schema: go to Supabase SQL editor and run `supabase/schema.sql`.

4. Start dev server:

```bash
npm run dev
```

Notes

- This scaffold provides core pages, components, a Supabase client, and an API service layer. Wiring to all UI forms is present but will need further UX polish and additional validation for production.
- RLS policies are included as examples—test them in Supabase and adjust logic for your security needs.

Local Supabase stack
npm install supabase --save-dev
npx supabase init
npx supabase start
# liquidate
liquidation of activities costs
