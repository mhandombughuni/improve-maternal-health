# TAFU dashboard v2

Built in the **existing** [Figma file](https://www.figma.com/design/9T8dgasyFx6L9KKVfNMncD?node-id=14-186), on the new **Dashboard v2** page. The earlier manually edited prototype remains on its original page.

| View | Desktop · 1440 px | Tablet · 834 px | Mobile · 390 px |
| --- | --- | --- | --- |
| Overview | [Open](https://www.figma.com/design/9T8dgasyFx6L9KKVfNMncD?node-id=14-186) | [Open](https://www.figma.com/design/9T8dgasyFx6L9KKVfNMncD?node-id=14-364) | [Open](https://www.figma.com/design/9T8dgasyFx6L9KKVfNMncD?node-id=14-528) |
| Staff detail | [Open](https://www.figma.com/design/9T8dgasyFx6L9KKVfNMncD?node-id=14-682) | [Open](https://www.figma.com/design/9T8dgasyFx6L9KKVfNMncD?node-id=14-784) | [Open](https://www.figma.com/design/9T8dgasyFx6L9KKVfNMncD?node-id=14-877) |

The revised application shell has a persistent sidebar on desktop, an icon rail on tablet, and bottom navigation on mobile. White cards and navigation sit on a warm cream background, with sand panels, teal actions, blue referral stages, and amber overdue flags.

Typography follows the user's edited source: DM Sans 36/700 page headings and counts, 24/700 section headings, 15/400 body, 15/600 record names, 13/500 metadata labels, 13/600 navigation emphasis, and IBM Plex Mono 12/400 for technical metadata. The original styles were reused; their font definitions were not changed.

Supervisor monitoring includes direct-report workload, overdue follow-ups, case completion, per-worker referral drill-down, and last recorded staff action. Outcome completion belongs to the assigned worker's case cohort; it does not imply that worker performed the receiving facility's action. The activity feed distinguishes individual actors and receiving-team events. No online presence or clinical performance scores are inferred.

Figma contains editable text, frames, vectors, shared metric components, and library button/avatar instances. No complete-screen raster fills were used. Icons are exact Lucide SVGs generated from the same library used in React. Desktop worklists were tightened after initial composition, staff examples were corrected to match Grace's assignments, and mobile staff navigation was added. All six layouts were visually reviewed.

The Figma walkthrough links Grace's overview row to the corresponding device-specific staff screen, and desktop/tablet Overview navigation returns to the corresponding overview. Figma's remaining sample controls are visual specifications; the working React application supplies the actual routing, search, filtering, export, and event workflows.

`build-dashboard-v2.js` records the first construction pass. `dashboard-v2-state.json` records the resulting frames and subsequent validation. Do not rerun the construction script over an existing page. Use recorded node IDs for future changes, preserving the user's edits.

Local implementation: http://127.0.0.1:5173/#overview
