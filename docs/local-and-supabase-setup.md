# Local prototype and Supabase setup

## What is implemented

The first working version uses React/TypeScript/Vite and a local Node API backed by persistent PGlite Postgres. This local harness avoids needing Docker or cloud accounts; it is not the proposed production server. The Supabase adapter calls the same `get_workspace` and `apply_command` SQL functions used by the local API. Fonts are bundled locally.

Limited active scope: referral creation, assigned follow-up, facility arrival/contact/outcome events, role-scoped queues, derived counts, CSV export, CHW notifications/acknowledgment, and one public World Bank context adapter. Updates require a network connection to the backend. No offline outbox, SMS, payments, AI model, full program analytics, or clinical decision support is included.

Figma is the frontend source of truth. The user's manual typography adjustments were read before implementation: page/card titles remain bold, record names and timeline titles are semibold, paragraph text is regular, and metadata is smaller. Legacy Figma construction scripts are archival and should not be rerun over the edited file.

## Local storage and identity

`npm run dev` binds to `127.0.0.1:5173`. Only loopback clients with an approved local Host header can reach the demo API. Cross-origin requests are rejected. Demo identities are fixed synthetic accounts; selecting one sets the database request identity, and Postgres policies/functions enforce that identity's access.

The database files are in ignored `.local/tafu-pg`; no records or passwords belong in Git. Keep one process open against that directory at a time. To restore seed data, stop the server and **rename** `.local` to a backup before restarting. Browser tests add synthetic records to the running local demo; database unit tests use their own isolated in-memory instance.

This is a single-computer, synthetic demonstration. It must not be exposed publicly with demo identity switching. The local API is not bundled into static hosting output.

## Move to Supabase when a project exists

1. Create a Supabase project in the intended region. Keep its database password and privileged keys out of the frontend and Git.
2. Run `supabase/migrations/202610150001_referral_loop.sql` through SQL Editor (or the Supabase migration CLI). It creates tables, row-level policies, RPC functions, grants, and server-side validation.
3. Run `supabase/seed.sql` once for synthetic demo data. The seed contains placeholder memberships, not actual Auth accounts.
4. Create five demo accounts through Supabase Authentication: supervisor, two CHWs, and one receiving account for each demo facility. Use distinct passwords; do not commit them.
5. In a local/private copy of `supabase/provision-demo.sql`, replace the example emails with those accounts' actual emails. Run the whole transaction in SQL Editor. It replaces seed identity IDs with real Auth user IDs and reassigns existing synthetic references. This provisioning script is one-time and fails atomically if an account is missing. Never grant users permission to provision their own roles.
6. Copy `.env.example` to `.env.local` and set:

```dotenv
VITE_BACKEND=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

The publishable key is designed for browser use and does not grant a staff role by itself. Authenticated identity and database permissions control access. Never use a service-role or secret key in a `VITE_` variable. Supabase's [API key documentation](https://supabase.com/docs/guides/getting-started/api-keys) explains this distinction.

7. Restart `npm run dev`. The local identity selector disappears; sign in using each provisioned demo account. For a frontend deployment, set these variables in its build environment before `npm run build`.
8. Optional public context: deploy `supabase/functions/country-context` with the Supabase CLI. Set `TAFU_ALLOWED_ORIGIN` to the exact frontend origin (local default: `http://127.0.0.1:5173`). The function verifies the user's Auth token and membership before fetching World Bank data. Configure the project gateway's JWT handling for the project's key type, retaining the function's explicit `getUser()` check; do not replace authorization with a publishable-key check. See [Supabase function authentication](https://supabase.com/docs/guides/functions/auth).

The browser integration uses `signInWithPassword`, `get_workspace`, `apply_command`, and the optional `country-context` function. There is no automatic deployment or cloud provisioning in this update.

## Validation and boundaries

The shared migration is executed in tests under real Postgres roles and row-level policies in PGlite, including direct-write denial and cross-organization isolation. These tests do not emulate Supabase Auth, PostgREST, hosted Edge Functions, or infrastructure configuration. Hosted sign-in and the optional Edge Function must be smoke-tested in the actual project before calling that deployment verified.

The public data adapter has a six-second timeout, response validation, a one-hour in-process cache, and a visible unavailable state. National estimates are context only, with their actual observation year. Rainfall and maps were intentionally deferred.

Clinical events are separate state transitions. A facility must record arrival before clinician contact, then an outcome with a note/category. Follow-ups have named owners and dates; their overdue status is operational, not a prediction of clinical urgency. Times are entered and displayed in Africa/Dar_es_Salaam (UTC+3), independently of the viewer's timezone.

Application commands are transactional and deduplicated per authenticated user/request ID. Reusing an ID with different input is rejected. Expected-version checks reject stale mutations. The seed and fixtures are synthetic, and real patient information remains outside this version's scope.

## Verified in this workspace · 15 October 2026

- `npm test`: six passing database/time tests, including actual RLS/grant enforcement, duplicate requests, cross-organization isolation, state ordering, and atomic notifications.
- `npm run build`: TypeScript and Vite production build passed.
- `npm run test:e2e`: two passing Chromium tests covering the complete referral journey, reload persistence, role handover, acknowledgment, typography, mobile width, queue filtering, CSV download, and a public-data outage.
- Runtime dependency audit: no known vulnerabilities reported at the time of the check.
- Live local World Bank adapter request returned a sourced observation with its 2023 observation year and retrieval timestamp; the UI does not relabel it as current-year district data.
- Supabase hosted Auth/PostgREST and the hosted Edge Function remain unverified because no cloud project is configured.
