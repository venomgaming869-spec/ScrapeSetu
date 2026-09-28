# ScrapSetu

An offline-first connection between e-waste collectors and authorized recyclers. The supplied screens in `figmaUI/` are the visual reference for portal layout and styling.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. Install packages with `npm install`.
3. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the ScrapSetu Supabase project.
4. Start the web app with `npm run dev`.

The local `.env.local` file is ignored by Git. The publishable key is intended for browser use; database authorization is enforced by RLS and guarded database functions.

## Database

Migrations are in `supabase/migrations/`. They create shared `profiles` plus separate one-to-one `collector_profiles` and `recycler_profiles`, lots, benchmarks, recycler matching, offers, handovers, payments, traceability events, RLS rules, and the private `e-waste-images` bucket. Supabase creates the shared and role-specific profile records automatically from signup metadata in one Auth trigger. Recycler signups also receive a pending recycler authorization record. Demo benchmark rows are tagged `Demo benchmark data - not a live market price` and should be replaced by an identified source before representing rates as current.

## Create test accounts

1. Register a Collector and a Recycler through `/register`, using test email/password accounts in Supabase Auth.
2. Confirm the accounts if email confirmation is enabled for the project.
3. Register or provision an Admin separately. Admin is never an option in public registration. For a prototype, sign up the intended admin account, then promote its matching `profiles.id` to `admin` through the Supabase SQL editor.
4. Sign in as Admin, verify and activate the Recycler, then assign accepted materials in Recycler Verification.
5. Sign in as Collector and create a lot. Sign in as the Recycler to submit a real offer. Return to Collector to accept it, then Recycler to confirm handover and set payment status.

Do not put shared demo passwords in frontend source or commit them. Use dedicated disposable test accounts and rotate/remove them after a demonstration.

## Core flow

Collector lot capture -> indicative benchmark -> compatible verified recycler -> recycler-submitted offer -> collector acceptance -> recycler-confirmed handover -> pending/paid payment record -> earnings and database traceability.

Offline lots (including image blobs) are held in IndexedDB. When connectivity returns, the app uploads the image to the private bucket and upserts the lot by its `offline_id`, keeping retries idempotent.

## Checks

- `npm run build` compiles the production app.
- Create one account for each role and run the Core flow above to exercise the connected database acceptance path.