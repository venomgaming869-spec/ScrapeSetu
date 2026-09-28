# ScrapSetu Implementation Plan

## Product constraint

The supplied `figmaUI` screens are the visual source of truth. Preserve their Kabadiwala Connect green, white, and soft-gray portal styling, using ScrapSetu as the primary product name where the screens allow it.

## Build phases

1. **Foundation** — React, Vite, Tailwind, routing, Supabase client, shared layouts, and responsive visual tokens. Status: implemented.
2. **Authentication and data** — Supabase sessions, role profiles, guarded routes, schema, RLS, private image storage, and clearly labeled development benchmarks. Status: implemented and applied to the connected project. Signup creates a shared profile and one role-specific profile (`collector_profiles` or `recycler_profiles`).
3. **Collector** — dashboard, offline-capable lot capture, image/material/weight/location, benchmark, compatible recycler matches, offers, and acceptance. Status: implemented.
4. **Recycler and transaction** — incoming lots, real offers, accepted lots, confirmed handover weight/location/time, payment status, and transaction record. Status: implemented.
5. **Ledger and traceability** — database-derived earnings and lot timeline; no fabricated transaction state. Status: implemented.
6. **Admin and release checks** — recycler verification, material/benchmark management, platform monitoring, responsive and accessibility checks. Status: implemented; visual browser review pending.

## Acceptance path

Collector creates an image-backed lot, a verified compatible recycler submits an offer, the collector chooses one, the recycler confirms handover, payment is recorded, and each role plus Admin can inspect the resulting transaction and event timeline. This still needs to be run using provisioned Collector, Recycler, and Admin accounts.

## Local setup

- `npm run dev` starts the local app; `npm run build` verifies the production bundle.
- Copy `.env.example` to `.env.local` and provide the Supabase URL and publishable/anon key.
- Demo benchmark rows are labeled `Demo benchmark data - not a live market price` in the database.
- Create demo Auth users through Supabase Auth; provision Admin role separately. Public registration offers Collector and Recycler only.
- The connected project currently has no Auth users or recycler businesses. Follow `README.md` to provision test roles and assign supported materials before running the acceptance path.
- The last production build passed before the final locality/sync refinements. The latest build and browser review were skipped; VS Code reports no diagnostics in the touched application files.