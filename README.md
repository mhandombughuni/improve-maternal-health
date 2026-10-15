# TAFU · Maternal referral coordination

A small working prototype for community health workers, CSO supervisors, and receiving facilities. The responsive dashboard frontend follows the user-edited [Figma design](https://www.figma.com/design/9T8dgasyFx6L9KKVfNMncD?node-id=14-186), including semibold record names/timeline labels and regular body text. Figma was read without changing the user's edits.

## Run locally

Requires Node.js 22 and npm. No Supabase account, Docker, API key, or paid service is needed for local mode.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. The first request initializes a persistent database under `.local/tafu-pg`. Run one local server at a time. Records survive page reloads and server restarts. `npm run build` checks types and builds the frontend; `npm run preview` serves that build with the same local API (stop the dev server first).

The local API runs on the Node/Vite server with PGlite (Postgres in WebAssembly), not in browser storage. It executes the same SQL schema, access policies, and workflow functions supplied for Supabase. Local identity switching is a synthetic demo convenience restricted to loopback; it is not production authentication. A static copy of `dist/` alone does not include this API.

## Try the referral loop

1. As Maria, choose **New referral**, enter a synthetic alias and note, choose Highland Demo Hospital and Grace, then create the referral.
2. Add a follow-up note and time. Reload to verify it persists.
3. Open the profile menu (top right), then switch **Demo team member** to **Receiving team · Highland**. Open the referral, then facility confirmation. Record arrival, clinician contact, and outcome in sequence.
4. Switch to **Grace · CHW**, open **Updates**, and acknowledge the outcome notification.
5. Return to Maria to see updated counts, filter the queue, or export CSV. Open **My team** to monitor direct reports, then select a worker to inspect assigned cases and recorded activity. Other tabs/users can use Refresh to retrieve current records.

There are 12 seeded synthetic records: eight open, three with follow-ups due, and four with outcomes recorded. Team members see only authorized records. An adverse outcome can still have a closed referral loop; closure is not a clinical success measure.

**Load public context** retrieves Tanzania's maternal mortality estimate from the World Bank. It shows the observation year, retrieval time, source link, and live/cached/unavailable status. Public-source failure does not affect the referral workflow. No patient data is sent to this source.

## Responsive supervisor dashboard

The white/cream/sand dashboard uses teal healthcare actions, blue workflow stages, and amber follow-up flags. Existing DM Sans typography is preserved. Desktop has a full sidebar, tablet an icon rail, and mobile bottom navigation. Overview combines operational counts, referral progress, team workload, a referral worklist, and recorded activity. See [the Figma views](design/dashboard-v2.md).

Staff monitoring uses explicit administrator-managed reporting lines. Supervisors see their direct reports' assigned/open/closed referrals, overdue follow-ups, and last recorded staff action. Clinical outcomes and staff-authored activity remain distinct; there is no inferred online presence or performance score.

## Backend and limited scope

- Transactional SQL commands validate role, organization, facility, assignment, event sequence, timestamps, and expected record version.
- Idempotency keys prevent a retried command from creating duplicate referrals, events, or notifications.
- CHW notifications are in-app records created atomically with outcomes. Acknowledgment is stored separately.
- Hosted mode uses Supabase Auth and RPC. SQL migrations and provisioning instructions are included in [Supabase setup](docs/local-and-supabase-setup.md).
- Offline synchronization, SMS, transport payments, clinical risk prediction, and live patient data are not implemented. Do not enter real patient information in this demo.

## Checks

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Database tests exercise the actual migration and seed in an isolated in-memory Postgres engine, including access controls, invalid transitions, duplicate retries, and notifications. Browser tests cover desktop/tablet/mobile dashboards and staff access, plus creation → reload → follow-up → facility outcome → CHW acknowledgment, plus mobile width and typography. GitHub Actions runs these checks on pushes and pull requests.

## Project references

- [Original concept assessment](docs/prototype-assessment.md)
- [Architecture and Figma handoff](docs/backend-and-design-handoff.md)
- [Current setup and verification limits](docs/local-and-supabase-setup.md)
- [Current dashboard designs and responsive frames](design/dashboard-v2.md)
- [Earlier Figma screen inventory](design/README.md)
- [HTML concept reference](reference/tafu-demo.html) — historical concept, with typography updates; some claims and controls remain illustrative.
