# Tafu frontend prototype

[Figma Design file](https://www.figma.com/design/9T8dgasyFx6L9KKVfNMncD?node-id=2-222)

| Screen | Node |
| --- | --- |
| Supervisor queue | 2:222 |
| Referral detail | 2:289 |
| CHW new referral | 2:345 |
| Facility confirmation | 2:383 |
| CHW closure notification | 2:423 |

In Figma presentation mode, follow Open referral → Open facility confirmation → Record outcome & notify CHW. The queue's New referral button opens the mobile form; Create referral navigates to the illustrative detail screen. Navigation is a walkthrough, without persisted state or backend writes. Other controls are design examples.

The design uses editable text, auto-layout frames, library button/input instances, a local ReferralRow component, and Tafu variables/styles. Main construction components sit outside the screen frames. Visual review corrected horizontal-container clipping and multiline text overlap; all five screens now use DM Sans for headings and body text, with IBM Plex Mono retained for metadata.

`figma-state.json` records the first creation's node IDs, variable IDs, and link targets. `create-figma-prototype.js` is the initial MCP construction source with layout corrections applied. It deliberately refuses to recreate an existing prototype; subsequent changes should target the recorded IDs. `connect-figma-prototype.js` records navigation wiring. These are Figma Plugin API scripts for MCP execution, not browser application code.

See [backend and implementation handoff](../docs/backend-and-design-handoff.md).

Heading hierarchy: H1–H6 and all subheadings use DM Sans Bold (700). The temporary wordmark is TAFU in uppercase and bold.

Implementation note: the user subsequently tightened typography manually in Figma. The React application was built from those current nodes, including 600-weight record/timeline labels. Figma is authoritative; the construction scripts describe earlier revisions and must not overwrite the manual edits.
