import {
  ArrowUpRight,
  ChevronRight,
  Clock3,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { Avatar, Button } from "./primitives";
import {
  eventLabel,
  formatTime,
  isDue,
  metrics,
  staffProgress,
  statusLabel,
  type Referral,
  type Workspace,
} from "./domain";
export function teamWorkspace(w: Workspace): Workspace {
  if (w.profile.role !== "supervisor") return w;
  const ids = new Set(w.staff.map((s) => s.user_id));
  const referrals = w.referrals.filter((r) => ids.has(r.chw_id));
  const cases = new Set(referrals.map((r) => r.id));
  return {
    ...w,
    referrals,
    events: w.events.filter((e) => cases.has(e.referral_id)),
  };
}
export function MetricCards({
  items,
}: {
  items: { label: string; value: number; detail: string }[];
}) {
  return (
    <div className="dashboard-metrics">
      {items.map((item) => (
        <section className="card metric" key={item.label}>
          <p className="small muted">{item.label}</p>
          <strong>{item.value}</strong>
          <p className="small muted">{item.detail}</p>
        </section>
      ))}
    </div>
  );
}
export function ReferralProgress({ referrals }: { referrals: Referral[] }) {
  const stages = [
    { key: "referred", label: "Awaiting arrival", color: "blue" },
    { key: "arrived", label: "At facility", color: "amber" },
    { key: "seen", label: "Seen by clinician", color: "teal" },
    { key: "closed", label: "Outcome recorded", color: "mint" },
  ];
  const counts = stages.map((s) => ({
    ...s,
    count: referrals.filter((r) => r.status === s.key).length,
  }));
  return (
    <section className="card">
      <div>
        <h2>Referral progress</h2>
        <p className="small muted">
          Current stage · {referrals.length} assigned referrals
        </p>
      </div>
      <div
        className="stage-bar"
        role="img"
        aria-label={counts
          .map((s) => `${s.count} ${s.label.toLowerCase()}`)
          .join(", ")}
      >
        {counts
          .filter((s) => s.count > 0)
          .map((s) => (
            <span key={s.key} className={s.color} style={{ flex: s.count }} />
          ))}
      </div>
      <div className="stage-legend">
        {counts.map((s) => (
          <div key={s.key}>
            <span className={`legend-dot ${s.color}`} />
            <span className="small muted">{s.label}</span>
            <strong className="small">{s.count}</strong>
          </div>
        ))}
      </div>
      {referrals.length === 0 && (
        <p className="small muted">
          Progress appears when referrals are assigned.
        </p>
      )}
    </section>
  );
}
export function TeamPanel({
  workspace: w,
  now = Date.now(),
  full = false,
}: {
  workspace: Workspace;
  now?: number;
  full?: boolean;
}) {
  const [query, setQuery] = useState("");
  const team = staffProgress(w, now).filter((s) =>
    s.member.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section
      className="card team-panel"
      aria-label="Staff activity and progress"
    >
      <div className="section-heading">
        <div>
          <h2>My team</h2>
          <p className="small muted">
            Assigned workload and case progress · {w.staff.length} direct
            reports
          </p>
        </div>
        {!full && (
          <a href="#team" className="subtle-link">
            View team <ArrowUpRight size={16} />
          </a>
        )}
      </div>
      {full && (
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Find a team member"
            placeholder="Find a team member"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      )}
      <div className="team-rows">
        {team.map((s) => (
          <a
            className="staff-row"
            href={`#staff/${s.member.user_id}`}
            key={s.member.user_id}
          >
            <div className="staff-identity">
              <Avatar initials={s.member.name[0]} />
              <div>
                <strong>{s.member.name}</strong>
                <span className="small muted">Community health worker</span>
              </div>
            </div>
            <div className="staff-counts">
              <span>
                <strong>{s.open}</strong> open
              </span>
              <span className={s.due ? "warning" : "muted"}>
                <strong>{s.due}</strong> overdue
              </span>
            </div>
            <div className="case-completion">
              <span className="small muted">
                {s.closed} of {s.assigned} outcomes recorded
              </span>
              <progress
                aria-label={`${s.member.name} referral completion`}
                value={s.closed}
                max={Math.max(s.assigned, 1)}
              />
              <span className="small muted last-action">
                Last staff action:{" "}
                {s.lastAction
                  ? formatTime(s.lastAction.recorded_at)
                  : "Not recorded"}
              </span>
            </div>
            <ChevronRight size={18} className="staff-chevron" />
          </a>
        ))}
      </div>
      {team.length === 0 && (
        <p className="muted">
          {query
            ? "No matching team members."
            : "No direct reports have been assigned to this supervisor."}
        </p>
      )}
      <p className="small muted">
        Case completion is an operational measure. Last staff action reflects
        recorded events.
      </p>
    </section>
  );
}
export function ActivityFeed({
  workspace: w,
  staffId,
  limit = 5,
}: {
  workspace: Workspace;
  staffId?: string;
  limit?: number;
}) {
  const events = w.events
    .filter((e) => !staffId || e.actor_id === staffId)
    .slice()
    .sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at))
    .slice(0, limit);
  return (
    <section className="card activity-panel">
      <div className="section-heading">
        <h2>{staffId ? "Recorded staff activity" : "Recent activity"}</h2>
        {limit === 5 && (
          <a
            href="#activity"
            className="subtle-link"
            aria-label="View all activity"
          >
            <ArrowUpRight size={18} />
          </a>
        )}
      </div>
      <ol className="activity-feed">
        {events.map((e) => {
          const r = w.referrals.find((r) => r.id === e.referral_id);
          const name =
            w.workers.find((m) => m.user_id === e.actor_id)?.name ??
            (e.actor_id === w.profile.user_id
              ? w.profile.name
              : "Receiving team");
          return (
            <li key={e.id}>
              <span
                className={`event-dot ${e.kind === "outcome" ? "mint" : "teal"}`}
              />
              <div>
                <strong>{name}</strong>
                <a href={`#referral/${e.referral_id}`} className="small">
                  {eventLabel[e.kind] ?? e.kind} · {r?.code}
                </a>
                <time className="metadata" dateTime={e.recorded_at}>
                  {formatTime(e.recorded_at)}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
      {events.length === 0 && (
        <p className="small muted">No staff actions recorded yet.</p>
      )}
      <p className="small muted">Open a record to review its full timeline.</p>
    </section>
  );
}
export function ReferralWorklist({
  workspace: w,
  limit = 5,
  query = "",
  staffId,
}: {
  workspace: Workspace;
  limit?: number;
  query?: string;
  staffId?: string;
}) {
  const records = w.referrals
    .filter(
      (r) =>
        (!staffId || r.chw_id === staffId) &&
        `${r.alias} ${r.code} ${r.village} ${w.workers.find((m) => m.user_id === r.chw_id)?.name}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(isDue(b)) - Number(isDue(a)) ||
        Date.parse(b.updated_at) - Date.parse(a.updated_at),
    )
    .slice(0, limit);
  return (
    <section className="card worklist-panel">
      <div className="section-heading">
        <div>
          <h2>Referral worklist</h2>
          <p className="small muted">Follow-up due first</p>
        </div>
        <a href="#queue" className="subtle-link">
          View all <ArrowUpRight size={16} />
        </a>
      </div>
      <div className="worklist-head small muted" aria-hidden="true">
        <span>Referral</span>
        <span>Assigned worker</span>
        <span>Status</span>
      </div>
      <div className="worklist">
        {records.map((r) => (
          <a className="worklist-row" href={`#referral/${r.id}`} key={r.id}>
            <div>
              <strong>
                {r.code} · {r.alias}
              </strong>
              <span className="small muted">{r.village}</span>
            </div>
            <span className="small muted">
              {w.workers.find((m) => m.user_id === r.chw_id)?.name ??
                "Assigned CHW"}
            </span>
            <span
              className={`badge ${isDue(r) ? "badge-warning" : r.status === "closed" ? "badge-good" : "badge-blue"}`}
            >
              {isDue(r) ? "Follow-up due" : statusLabel[r.status]}
            </span>
          </a>
        ))}
      </div>
      {records.length === 0 && (
        <p className="muted">No referrals to display.</p>
      )}
    </section>
  );
}
export function Overview({
  workspace,
  now,
  onDue,
  onExport,
}: {
  workspace: Workspace;
  now: number;
  onDue: () => void;
  onExport: () => void;
}) {
  const w = teamWorkspace(workspace);
  const m = metrics(w.referrals, now);
  const supervisor = w.profile.role === "supervisor";
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Overview</h1>
          <p className="muted">Your team, referrals, and the next action.</p>
        </div>
        <div className="heading-actions">
          {w.profile.role !== "facility" && (
            <Button
              onPress={() => {
                location.hash = "new";
              }}
            >
              <Plus size={18} />
              New referral
            </Button>
          )}
          <Button variant="neutral" onPress={onExport}>
            Export report
          </Button>
        </div>
      </div>
      <MetricCards
        items={[
          {
            label: "Open referrals",
            value: m.open,
            detail: "Across your team",
          },
          {
            label: "Follow-ups due",
            value: m.due,
            detail: "Need a next action",
          },
          {
            label: "Outcomes",
            value: m.closed,
            detail: `Of ${w.referrals.length} referrals`,
          },
          {
            label: supervisor ? "My team" : "Assigned cases",
            value: supervisor ? w.staff.length : w.referrals.length,
            detail: supervisor
              ? "Community health workers"
              : "Current demo cohort",
          },
        ]}
      />
      <div className="dashboard-split">
        <ReferralProgress referrals={w.referrals} />
        <aside className="card attention-panel">
          <h2>
            <Clock3 size={20} />
            Needs attention
          </h2>
          <strong>
            {m.due
              ? `${m.due} follow-ups are overdue.`
              : "No follow-ups are overdue."}
          </strong>
          <p className="muted">
            {m.due
              ? "Review transport and contact updates with the assigned workers."
              : "Review your worklist for the next handover."}
          </p>
          <Button onPress={onDue}>Review follow-ups</Button>
        </aside>
      </div>
      {supervisor && <TeamPanel workspace={w} now={now} />}
      <div className="dashboard-split">
        <ReferralWorklist workspace={w} />
        <ActivityFeed workspace={w} />
      </div>
    </>
  );
}
export function StaffDetail({
  workspace: w,
  staffId,
  now,
}: {
  workspace: Workspace;
  staffId: string;
  now: number;
}) {
  const s = staffProgress(w, now).find((s) => s.member.user_id === staffId);
  if (!s)
    return (
      <section className="card">
        <h1>Staff member not available</h1>
        <p>Choose one of your direct reports.</p>
        <a href="#team">Back to my team</a>
      </section>
    );
  return (
    <>
      <a className="subtle-link" href="#team">
        My team / {s.member.name}
      </a>
      <div className="page-heading">
        <div>
          <h1>{s.member.name}</h1>
          <p className="muted">
            Community health worker · Reports to {w.profile.name}
          </p>
        </div>
        <Avatar initials={s.member.name[0]} />
      </div>
      <MetricCards
        items={[
          {
            label: "Assigned cases",
            value: s.assigned,
            detail: "Current demo cohort",
          },
          {
            label: "Open referrals",
            value: s.open,
            detail: "Continued follow-up",
          },
          {
            label: "Follow-ups due",
            value: s.due,
            detail: "Review with the worker",
          },
          {
            label: "Outcomes",
            value: s.closed,
            detail: "Recorded by facilities",
          },
        ]}
      />
      <section className="card">
        <h2>Case progress</h2>
        <p>
          {s.closed} of {s.assigned} assigned referrals have outcomes recorded.
        </p>
        <progress
          aria-label="Staff referral completion"
          max={Math.max(1, s.assigned)}
          value={s.closed}
        />
        <p className="small muted">
          Last staff action:{" "}
          {s.lastAction ? formatTime(s.lastAction.recorded_at) : "Not recorded"}
          . Case completion is an operational measure, not a clinical
          performance score.
        </p>
      </section>
      <div className="dashboard-split">
        <ReferralWorklist workspace={w} staffId={staffId} limit={1000} />
        <ActivityFeed workspace={w} staffId={staffId} limit={10} />
      </div>
    </>
  );
}
