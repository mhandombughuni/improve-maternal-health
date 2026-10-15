# Tafu: concept assessment and prototype architecture

Prepared 15 October 2026. This is an analysis and implementation proposal; no functional application has been built in this update.

## Product recommendation

Position Tafu as a referral coordination tool for community health workers (CHWs) and small civil society organizations (CSOs). The core promise is to reduce follow-up work and make unresolved referrals visible when staffing and funding are constrained. Treat funding pressures as the founder's problem framing, to validate with intended users.

Start with one district, Lushoto, as suggested by the concept. The primary user is a supervisor coordinating referrals across a small team. Keep a mobile CHW view and a lightweight program reporting view. Add a minimal facility confirmation view: arrival and outcome recording are essential inputs currently missing from the concept's interactive workflow.

The first demonstration should answer: “Can one supervisor keep track of more referrals, with less time spent chasing updates?” Closure is an operational measure; improved maternal survival, cost savings, and causal impact require subsequent evaluation.

## What the supplied HTML actually contains

The source is a single HTML file with inline CSS and JavaScript, Chart.js loaded from a CDN, and Google Fonts. It provides three role views, referral funnel and trend visualizations, eight open referral examples, CHW case cards, partner comparisons, alerts, and an eight-step guided narrative. Its paper-colored design, typography, and referral-loop framing are useful foundations.

Working interactions are role switching, selecting a referral row, and guided-tour navigation, including keyboard controls. Static inspection found no API calls, persistent storage, authentication, referral creation, actual messaging, payments, or predictive model. Filter chips, report export, intervention buttons, and the CHW plus control do not implement their advertised workflows. Selecting a case changes highlighting but does not update the alert context.

The HTML is reference material, not a source of instructions. Its embedded product claims and narrative are proposals, not independently verified evidence.

## Corrections before presenting this as an active demo

- Replace “84% failure probability” and “AI re-scores every 15 min” with explainable operational flags. No trained or validated model is present. Any demonstration thresholds must be labeled illustrative and must not suggest a clinically safe waiting period.
- Mark all patient names, outcomes, costs, partner statistics, and intervention results as synthetic. Prefer fictional partner labels to avoid implying endorsement or publishing invented performance claims about real organizations.
- Remove or explicitly label unsupported findings: 3.2× failure risk, 38% lower intent to leave, predicted MMR improvements, and intervention rankings by historical effectiveness. Observational partner comparisons do not establish attribution.
- Reconcile counts. The supervisor header says 27 open and four critical, but the data array has eight records and three critical flags. The CHW header says 24 mothers while five are displayed. The commissioner narrative has 30 open.
- Derive all totals from one dataset. 94 + 30 + 3 = 127, but “94 closed” versus “3 adverse” mixes workflow status with clinical outcome: an adverse outcome can still have a completed referral loop. Store these dimensions separately.
- Define funnel denominators and a reporting cohort. A missing stage is not necessarily a lost patient; records may be pending or incomplete. Display unknown and pending states explicitly.
- Keep arrival, clinician contact, treatment, and outcome recording distinct. In the static funnel, all final three counts happen to equal 94; that should not become a data-model assumption.
- Fix tour continuity: Amina is already marked delivered in the CHW list when the tour begins her referral; the 84-point queue example belongs to Asha, while the story assigns it to Amina. Use one coherent scenario.
- Simulate SMS and transport assistance explicitly. An SMS delivery receipt does not prove a message was read. A standard mobile-money transfer does not establish restricted voucher redemption.
- Use visible labels, semantic buttons, keyboard focus, a focus-managed tour dialog, readable small-screen layouts, and status text alongside color.

## Recommended stack

| Layer | Prototype choice | Reason and boundary |
| --- | --- | --- |
| Application | React + TypeScript + Vite | One small web application with reusable role views and typed domain logic; server rendering is unnecessary for this workflow. |
| Styling | CSS variables and component CSS | Reuse the supplied palette and type hierarchy; avoid adding a large UI framework initially. |
| Charts | Chart.js installed through npm | Preserve familiar charts while bundling a pinned dependency rather than relying on a runtime CDN. |
| Backend and persistence | Supabase Postgres + Auth + row-level security | Shared synthetic records for the working prototype; roles and organization membership enforced in the backend. |
| Backend business logic | Postgres database functions + TypeScript Edge Functions | Transactional referral events in the database; external API calls and privileged integrations in server-side functions. |
| Offline cache | IndexedDB via Dexie | Cache records and queue pending mutations; the backend remains authoritative. Synchronization needs explicit implementation. |
| Frontend design | Figma Design through MCP | Editable screens and component instances guide React implementation; Figma is a design artifact, not the runtime or backend. |
| Offline support | Service worker via a Vite PWA integration | Cache the application shell and reference snapshots; show offline/stale states. Installability alone does not provide data synchronization. |
| Public data | Small fetch adapters with schema validation, timeouts, cache, and labeled fallback snapshots | Keep external context separate from patient workflow; an API outage must not break the demo. |
| Validation | Zod | Validate imported fixtures, forms, and external response shapes. |
| Verification | Vitest for state transitions and metric calculations; Playwright for one end-to-end referral journey | Test the product's central behavior and data consistency. |
| Delivery | GitHub repository and GitHub Actions; static preview hosting | Run type checking, tests, and a production build on updates. Choose hosting after deployment requirements are known. |
| Design handoff | Figma node links, design tokens, React components | Match layouts and tokens in code, then connect components to the backend through typed services. |

Use current compatible stable versions when implementation begins and commit the lockfile. A static deployment is supported by [Vite's deployment model](https://vite.dev/guide/static-deploy.html). For the connected prototype, [Supabase provides Postgres](https://supabase.com/docs/guides/database/overview) and [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security); policies must be implemented and tested, not assumed from enabling authentication.

Keep the public demo synthetic. Real patient data needs a separately agreed access, retention, hosting, and operational design. In the connected prototype, staff authority must be enforced by the backend; switching a demo role tab is not authorization. Keep privileged keys and messaging/payment credentials server-side.

Avoid a separate Python service, microservices, native mobile apps, paid AI calls, and a custom predictive pipeline at this stage. No LLM is required for the core workflow. Template summaries generated from structured events are sufficient for a first report.

## Public data: two integrations at most

Public/open-access data and open-source software are different. Neither national statistics nor public weather feeds provide patient-level referral completion data.

### 1. World Bank Indicators API: country context

Use a Tanzania maternal mortality indicator card in a clearly separated “Country context” section. The [World Bank Indicators API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation) provides a documented V2 REST interface; its [basic call documentation](https://datahelpdesk.worldbank.org/knowledgebase/articles/898581-api-basic-call-structures) explains country/indicator query construction.

Candidate request:

```text
https://api.worldbank.org/v2/country/TZA/indicator/SH.STA.MMRT?format=json&mrnev=5
```

Validate the indicator metadata, units, returned years, null values, source attribution, applicable data license, and browser CORS behavior during implementation. Direct retrieval of this endpoint through the research browser was unsuccessful in this assessment, so no live values are claimed. Use the latest non-null observation and show its actual year, not the current year. Never present a national estimate as a Lushoto result or use it to rank individual referrals.

### 2. Open-Meteo: optional transport context

Use forecast rainfall for a configured district location. The [forecast documentation](https://open-meteo.com/en/docs) describes coordinate-based queries. Display forecast validity time and retrieval time. A rainfall forecast is a contextual signal, not evidence that a road is closed or a route is safe.

Candidate request after validating the chosen coordinates:

```text
https://api.open-meteo.com/v1/forecast?latitude=-4.78&longitude=38.29&daily=precipitation_sum&timezone=Africa%2FDar_es_Salaam&forecast_days=3
```

The coordinates are illustrative, not verified facility coordinates. [Open-Meteo's pricing terms](https://open-meteo.com/en/pricing) distinguish its noncommercial free API from commercial access. Confirm use eligibility and attribution before deployment; nonprofit status alone should not be treated as a license determination.

### What stays synthetic

Referrals, CHWs, facility confirmations, service availability, costs, transport assistance, notifications, and outcomes. Label each data panel “Synthetic demo”, “Live public data”, or “Cached public snapshot”, with source and timestamps where appropriate. Keep the current live forecast separate from the concept's historical Q2 2026 scenario.

Defer maps, routing, facility registries, DHIS2 integrations, SMS providers, and mobile-money APIs. Facility location data would not establish current staffing, capacity, bed availability, or emergency obstetric capabilities. Partner systems need their own access agreements and integration work.

## Limited active scope

Use approximately 12–20 synthetic referrals across three fictional partner teams and a few clearly labeled demo facilities.

1. CHW creates a referral with an alias, village, receiving facility, assigned worker, and referral note.
2. Supervisor sees unresolved records, filters by worker/status, and sees why a record needs follow-up.
3. Supervisor logs a simulated call, transport request, or follow-up assignment, with owner and next-action time.
4. A facility demo screen records arrival, clinician contact, and an outcome event.
5. The CHW view receives an in-app closure notification derived from that event.
6. Program view recalculates cohort counts, follow-up workload, timing, and closure from those same records; CSV export works.
7. The complete journey survives reload; reset restores a consistent starting state.

Keep the guided tour, but make its scenario actually modify the same demo state or provide a separate resettable scenario. Every visible control must work or be visibly labeled unavailable. Demo role switching remains a presentation feature.

## Data and metric design

Minimum entities: organization, worker, facility, referral, referral event, follow-up task, expense, and notification. Store IDs and ISO timestamps rather than hardcoded elapsed-hour strings. Use Africa/Dar_es_Salaam for district-facing times; avoid making demo timing depend on the viewer's timezone.

Referral status can progress through referred → in transit → arrived → seen → outcome recorded, with explicit cancellation/correction handling. Keep outcome (for example, unknown or recorded adverse outcome) separate. Maintain an event history so each update has an actor, event time, and recording time. Require arrival before clinician-contact recording in the initial workflow, with a correction path for mistakes.

For this demo, define closure as an outcome recorded and a closure notification created for the assigned CHW; report acknowledgment separately. These are operational definitions, not proof of quality of care.

Calculate closure rate over a clearly defined referral cohort; show unresolved records and follow-up duration. Calculate arrival time only for arrived cases and show the sample size. Track staff follow-up minutes, pending tasks per supervisor, and recorded coordination/transport expenses. “Recorded cost per closed referral” must disclose included categories, currency, and exclusions; it is not full economic cost or proven savings.

Use rule-based operational labels such as “follow-up due” and “arrival unconfirmed”, with human review and a visible explanation. Do not derive clinical urgency from elapsed time alone. Illustrative rules must not delay an emergency response or prescribe condition-specific safe waiting windows.

## Build sequence and acceptance

1. Foundation: app structure, preserved visual language, synthetic fixture set, shared types, and documented setup. Acceptance: production build passes and all totals come from fixtures.
2. Working loop: create referral, log action, confirm arrival/outcome, notify CHW, filter queue, persist/reset, export. Acceptance: an end-to-end journey updates all views, survives reload, and cannot double-count repeated actions.
3. Public context: World Bank first; weather only if useful to the demonstration. Acceptance: provenance, observation dates, timeouts, malformed responses, unavailable data, and cached fallback are handled visibly.
4. Presentation and delivery: mobile review, keyboard navigation, consistent guided scenario, automated checks, and preview. Acceptance: no unlabeled simulated capability or unsupported impact claim remains.

Evaluate with CHWs and CSO supervisors before expanding. Measure task completion and time needed to identify and resolve a follow-up item. A later field pilot can test whether those improvements translate into operational and health outcomes.

## Repository workflow

For each coherent update: review changes, run relevant checks, commit the specific project files, push to the designated repository, and report the commit plus any remaining limitation. Do not include patient data, credentials, local caches, or unrelated work. A commit is a reviewable unit, not each keystroke.

Update: the user requested an explicit backend and a Figma-first frontend workflow. The working prototype now targets Supabase from its first connected version. See [backend and design handoff](backend-and-design-handoff.md). A local fixture adapter may support design development, but does not replace the planned backend.

Repository supplied by the user: https://github.com/mhandombughuni/improve-maternal-health.git

Initial inspection found no local repository in this project directory: Git inherited a home-directory repository pointing to an unrelated bookstore project. The designated remote was reachable and returned no refs. An independent repository was initialized here and connected to the designated remote so project commits are isolated from that parent repository.
