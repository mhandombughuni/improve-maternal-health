import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  configurationError,
  getActors,
  getContext,
  getWorkspace,
  hosted,
  sendCommand,
  supabase,
  type Actor,
  type Context,
} from "./api";
import {
  eatInput,
  eatToIso,
  eventLabel,
  formatTime,
  isDue,
  metrics,
  statusLabel,
  type Command,
  type Referral,
  type Result,
  type Workspace,
} from "./domain";
import { Button, InputField, SelectField } from "./primitives";
const go = (path: string) => {
  window.location.hash = path;
  window.scrollTo(0, 0);
};
function useRoute() {
  const [route, set] = useState(location.hash.slice(1) || "queue");
  useEffect(() => {
    const update = () => set(location.hash.slice(1) || "queue");
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return route;
}
function message(e: unknown) {
  return e instanceof Error
    ? e.message
    : "Unable to complete the request. Try again.";
}
function PageHead({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <h1>{title}</h1>
      {children && <p className="muted">{children}</p>}
    </>
  );
}
function csvDownload(referrals: Referral[], w: Workspace) {
  const cell = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const rows = [
    [
      "Referral",
      "Alias (synthetic)",
      "Village",
      "Facility",
      "Status",
      "Created",
      "Outcome recorded",
    ],
    ...referrals.map((r) => [
      r.code,
      r.alias,
      r.village,
      w.facilities.find((f) => f.id === r.facility_id)?.name,
      statusLabel[r.status],
      r.created_at,
      r.outcome_at ?? "",
    ]),
  ];
  const blob = new Blob(
    [rows.map((row) => row.map(cell).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tafu-synthetic-referrals.csv";
  a.click();
  URL.revokeObjectURL(url);
}
export default function App() {
  const route = useRoute();
  const [actors, setActors] = useState<Actor[]>([]);
  const [actor, setActor] = useState("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(configurationError);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"open" | "due" | "closed">("open");
  const [clock, setClock] = useState(Date.now());
  const pending = useRef<Command | null>(null);
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    let active = true;
    if (hosted && supabase) {
      void supabase.auth.getSession().then(({ data, error }) => {
        if (active) {
          if (error) setError(error.message);
          setActor(data.session?.user.id ?? "");
        }
      });
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) {
          setActor(session?.user.id ?? "");
          setWorkspace(null);
        }
      });
      return () => {
        active = false;
        data.subscription.unsubscribe();
      };
    }
    if (!hosted)
      void getActors()
        .then((a) => {
          if (active) {
            setActors(a);
            const remembered = sessionStorage.getItem("tafu-actor");
            setActor(
              a.some((x) => x.id === remembered) ? remembered! : a[0].id,
            );
          }
        })
        .catch((e) => {
          if (active) setError(message(e));
        });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!actor) {
      setWorkspace(null);
      return;
    }
    let active = true;
    setLoading(true);
    setWorkspace(null);
    setError(null);
    pending.current = null;
    void getWorkspace(actor)
      .then((w) => {
        if (active) setWorkspace(w);
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [actor]);
  async function refresh() {
    if (!actor) return;
    setLoading(true);
    setError(null);
    try {
      setWorkspace(await getWorkspace(actor));
      setClock(Date.now());
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }
  async function execute(
    action: Command["action"],
    payload: Command["payload"],
  ): Promise<Result | null> {
    if (busy) return null;
    setBusy(true);
    setError(null);
    setNotice("");
    // Reuse the same key after an uncertain response, so a retry cannot duplicate a database write.
    if (
      !pending.current ||
      pending.current.action !== action ||
      JSON.stringify(pending.current.payload) !== JSON.stringify(payload)
    )
      pending.current = { requestId: crypto.randomUUID(), action, payload };
    try {
      const result = await sendCommand(actor, pending.current);
      setWorkspace(await getWorkspace(actor));
      pending.current = null;
      setNotice("Saved successfully.");
      return result;
    } catch (e) {
      setError(message(e));
      return null;
    } finally {
      setBusy(false);
    }
  }
  const profile = workspace?.profile;
  const kind = route.split("/")[0];
  const selected = workspace?.referrals.find(
    (r) => r.id === route.split("/")[1],
  );
  const mobile = kind === "new" || kind === "notifications";
  const figures = workspace ? metrics(workspace.referrals, clock) : null;
  function selectActor(id: string) {
    sessionStorage.setItem("tafu-actor", id);
    setActor(id);
    setNotice("");
    setError(null);
    go("queue");
  }
  return (
    <main
      className={`app ${mobile ? "mobile" : kind === "facility" ? "facility-view" : ""}`}
    >
      <header className="brand">
        <a className="wordmark" href="#queue" aria-label="TAFU home">
          TAFU
        </a>
        <span className="tagline">Maternal referral coordination</span>
        {profile && (
          <span className="profile">
            {profile.role === "chw"
              ? "CHW"
              : profile.role === "facility"
                ? "Facility"
                : "Supervisor"}{" "}
            · {profile.name}
          </span>
        )}
      </header>
      <div className="eyebrow">SYNTHETIC DEMO · LUSHOTO</div>
      <div className="workspace-bar">
        <span className="small muted">
          {hosted ? "Connected demo" : "Local demo · Saved on this computer"}
        </span>
        {!hosted && actors.length > 0 && (
          <label className="actor-select">
            Demo team member{" "}
            <select
              aria-label="Demo team member"
              value={actor}
              onChange={(e) => selectActor(e.target.value)}
              disabled={busy || loading}
            >
              {actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {hosted && actor && (
          <Button
            variant="neutral"
            disabled={busy || loading}
            onPress={() => {
              void supabase?.auth.signOut();
            }}
          >
            Sign out
          </Button>
        )}
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          {actor && !configurationError && (
            <Button
              variant="neutral"
              onPress={() => void refresh()}
              disabled={busy || loading}
            >
              Refresh records
            </Button>
          )}
        </div>
      )}
      {notice && (
        <p className="success small" role="status">
          {notice}
        </p>
      )}
      {hosted && !actor && !configurationError && <Login onError={setError} />}
      {loading && !workspace && (
        <p role="status">Loading the shared referral record…</p>
      )}
      {workspace && figures && (
        <>
          <nav className="nav" aria-label="Workspace">
            <a
              href="#queue"
              aria-current={kind === "queue" ? "page" : undefined}
            >
              Referrals
            </a>
            {profile?.role === "chw" && (
              <a
                href="#notifications"
                aria-current={kind === "notifications" ? "page" : undefined}
              >
                Updates ·{" "}
                {
                  workspace.notifications.filter((n) => !n.acknowledged_at)
                    .length
                }
              </a>
            )}
            <button
              className="text-button"
              onClick={() => void refresh()}
              disabled={busy || loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </nav>
          {kind === "queue" && (
            <>
              <PageHead title="Keep every referral in view.">
                A shared follow-up queue for a team doing more with less.
              </PageHead>
              <div className="stats">
                {[
                  [figures.open, "Open referrals"],
                  [figures.due, "Follow-ups due"],
                  [figures.closed, "Outcomes recorded"],
                ].map(([value, label]) => (
                  <section className="card stat" key={label}>
                    <strong>{value}</strong>
                    <p className="small muted">{label}</p>
                  </section>
                ))}
              </div>
              <div className="toolbar">
                <Button
                  variant="neutral"
                  aria-pressed={filter === "open"}
                  onPress={() => setFilter("open")}
                >
                  All open · {figures.open}
                </Button>
                <Button
                  variant="neutral"
                  aria-pressed={filter === "due"}
                  onPress={() => setFilter("due")}
                >
                  Follow-up due · {figures.due}
                </Button>
                <Button
                  variant="neutral"
                  aria-pressed={filter === "closed"}
                  onPress={() => setFilter("closed")}
                >
                  Outcomes · {figures.closed}
                </Button>
                {profile?.role !== "facility" && (
                  <Button onPress={() => go("new")}>New referral</Button>
                )}
                <Button
                  variant="neutral"
                  onPress={() => csvDownload(workspace.referrals, workspace)}
                >
                  Export CSV
                </Button>
              </div>
              <Queue workspace={workspace} filter={filter} now={clock} />
              <p className="small muted">
                All records are synthetic. Counts reflect the referrals visible
                to the selected team member.
              </p>
              <CountryContext actor={actor} />
            </>
          )}
          {kind === "new" &&
            (profile?.role === "supervisor" || profile?.role === "chw") && (
              <NewReferral
                key={actor}
                workspace={workspace}
                execute={execute}
                busy={busy}
              />
            )}
          {(kind === "referral" || kind === "facility") &&
            (selected ? (
              <>
                <Button variant="neutral" onPress={() => go("queue")}>
                  Back to queue
                </Button>
                {kind === "facility" ? (
                  <Facility
                    key={selected.id}
                    referral={selected}
                    workspace={workspace}
                    execute={execute}
                    busy={busy}
                  />
                ) : (
                  <Detail
                    key={selected.id}
                    referral={selected}
                    workspace={workspace}
                    execute={execute}
                    busy={busy}
                  />
                )}
              </>
            ) : (
              <div className="card">
                <h1>Referral not available</h1>
                <p>This team member cannot access the selected referral.</p>
                <Button onPress={() => go("queue")}>Back to queue</Button>
              </div>
            ))}
          {kind === "notifications" && profile?.role === "chw" && (
            <Notifications
              workspace={workspace}
              execute={execute}
              busy={busy}
            />
          )}
          {!["queue", "new", "referral", "facility", "notifications"].includes(
            kind,
          ) && (
            <>
              <h1>Page not found</h1>
              <a href="#queue">Return to referrals</a>
            </>
          )}
        </>
      )}
    </main>
  );
}
type Execute = (
  action: Command["action"],
  payload: Command["payload"],
) => Promise<Result | null>;
function Queue({
  workspace: w,
  filter,
  now,
}: {
  workspace: Workspace;
  filter: "open" | "due" | "closed";
  now: number;
}) {
  const records = w.referrals
    .filter((r) =>
      filter === "due"
        ? isDue(r, now)
        : filter === "closed"
          ? r.status === "closed"
          : r.status !== "closed",
    )
    .sort(
      (a, b) =>
        Number(isDue(b, now)) - Number(isDue(a, now)) ||
        Date.parse(a.created_at) - Date.parse(b.created_at),
    );
  const first = records[0];
  const name = (id: string) =>
    w.workers.find((m) => m.user_id === id)?.name ?? "Assigned CHW";
  const facility = (r: Referral) =>
    w.facilities.find((f) => f.id === r.facility_id)?.name;
  return (
    <div className="queue-grid">
      <div className="stack queue-list">
        {records.length === 0 ? (
          <section className="card">
            <h2>
              {filter === "due"
                ? "No follow-ups due."
                : "No referrals in this view."}
            </h2>
            <p className="muted">Choose another filter or create a referral.</p>
          </section>
        ) : (
          records.map((r) => (
            <a className="referral-row" href={`#referral/${r.id}`} key={r.id}>
              <strong>
                {r.code} · {r.alias} · {r.village}
              </strong>
              <span className="small muted">
                {name(r.chw_id)} → {facility(r)}
              </span>
              <span
                className={`small ${r.status === "closed" ? "success" : "accent"}`}
              >
                {statusLabel[r.status]}
                {isDue(r, now) ? " · Follow-up due" : ""}
              </span>
            </a>
          ))
        )}
      </div>
      {first && (
        <aside className="card next-action">
          <h2>
            {first.status === "closed"
              ? "The loop is closed."
              : `Follow up with ${name(first.chw_id).split(" ")[0]}`}
          </h2>
          <p>
            <strong className="semibold">
              {first.code} · {first.alias}
            </strong>
            <br />
            {first.follow_up_note ?? first.note}
            {first.follow_up_owner && first.status !== "closed"
              ? ` ${first.follow_up_owner} owns the next follow-up.`
              : ""}
          </p>
          <Button onPress={() => go(`referral/${first.id}`)}>
            Open referral
          </Button>
          <p className="small muted">
            Operational flag explained
            <br />
            {first.status === "referred"
              ? "No facility arrival event has been recorded."
              : statusLabel[first.status] + "."}
          </p>
        </aside>
      )}
    </div>
  );
}
function Detail({
  referral: r,
  workspace: w,
  execute,
  busy,
}: {
  referral: Referral;
  workspace: Workspace;
  execute: Execute;
  busy: boolean;
}) {
  const [note, setNote] = useState("");
  const [due, setDue] = useState(eatInput(new Date(Date.now() + 3600000)));
  const events = w.events.filter((e) => e.referral_id === r.id);
  const facility = w.facilities.find((f) => f.id === r.facility_id);
  const worker = w.workers.find((m) => m.user_id === r.chw_id);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await execute("follow_up", {
      referral_id: r.id,
      expected_version: r.version,
      note,
      due_at: eatToIso(due),
    });
    if (result) setNote("");
  }
  return (
    <>
      <PageHead title={`${r.alias}’s referral`}>
        {r.code} · {r.village} → {facility?.name} · Assigned CHW: {worker?.name}
      </PageHead>
      <div className="detail-grid">
        <section className="card">
          <h2>One record. A shared history.</h2>
          <ol className="timeline">
            {events.map((e, i) => (
              <li key={e.id}>
                <strong className="semibold">
                  {String(i + 1).padStart(2, "0")}　
                  {eventLabel[e.kind] ?? e.kind}
                </strong>
                <p className="small muted">{formatTime(e.occurred_at)}</p>
                {e.note && <p className="small muted">{e.note}</p>}
              </li>
            ))}
          </ol>
          <p className="small muted">
            {statusLabel[r.status]} · Version {r.version}
          </p>
        </section>
        <section className="card">
          <h2>Make the next move clear.</h2>
          {r.status === "closed" ? (
            <>
              <p className="success">
                Outcome recorded. The assigned CHW has an in-app update.
              </p>
              <p className="small muted">
                Outcome category: {r.outcome?.replaceAll("_", " ")}. Loop
                completion does not imply a positive clinical outcome.
              </p>
            </>
          ) : w.profile.role === "facility" ? (
            <>
              <p className="muted">
                Record the next handover event as the receiving team.
              </p>
              <Button onPress={() => go(`facility/${r.id}`)}>
                Open facility confirmation
              </Button>
            </>
          ) : (
            <form onSubmit={submit} className="stack">
              <InputField label="Owner" value={w.profile.name} readOnly />
              <InputField
                label="Follow-up time (EAT / UTC+3)"
                type="datetime-local"
                step={1}
                required
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
              <InputField
                label="Note"
                placeholder="What needs to happen next?"
                required
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save follow-up"}
              </Button>
              <p className="small muted">
                To record arrival or an outcome, switch to the receiving
                facility team in this demo.
              </p>
            </form>
          )}
          <p className="small muted">
            Calls, messages, and payments are simulated. In-app record updates
            are saved.
          </p>
        </section>
      </div>
    </>
  );
}
function NewReferral({
  workspace: w,
  execute,
  busy,
}: {
  workspace: Workspace;
  execute: Execute;
  busy: boolean;
}) {
  const [alias, setAlias] = useState("");
  const [village, setVillage] = useState("Mlalo");
  const [facility, setFacility] = useState(w.facilities[0]?.id ?? "");
  const [worker, setWorker] = useState(
    w.profile.role === "chw"
      ? w.profile.user_id
      : (w.workers[0]?.user_id ?? ""),
  );
  const [note, setNote] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await execute("create", {
      alias,
      village,
      facility_id: facility,
      chw_id: worker,
      note,
    });
    if (result) go(`referral/${result.referral_id}`);
  }
  return (
    <>
      <Button variant="neutral" onPress={() => go("queue")}>
        Back to queue
      </Button>
      <PageHead title="New referral">
        Start a shared follow-up record. Use a synthetic patient alias.
      </PageHead>
      <form onSubmit={submit} className="stack form">
        <InputField
          label="Patient alias"
          placeholder="Amina · demo patient"
          required
          maxLength={80}
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
        />
        <InputField
          label="Village"
          required
          maxLength={80}
          value={village}
          onChange={(e) => setVillage(e.target.value)}
        />
        <SelectField
          label="Receiving facility"
          value={facility}
          onChange={(e) => setFacility(e.target.value)}
        >
          {w.facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </SelectField>
        {w.profile.role === "supervisor" && (
          <SelectField
            label="Assigned CHW"
            value={worker}
            onChange={(e) => setWorker(e.target.value)}
          >
            {w.workers.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </SelectField>
        )}
        <InputField
          label="Referral note"
          placeholder="Facility assessment requested"
          required
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create referral"}
        </Button>
      </form>
      <p className="small muted">
        This first version saves online. Offline synchronization is not enabled.
      </p>
      <p className="small muted">
        Use the established emergency referral process whenever urgent care is
        needed.
      </p>
    </>
  );
}
function Facility({
  referral: r,
  workspace: w,
  execute,
  busy,
}: {
  referral: Referral;
  workspace: Workspace;
  execute: Execute;
  busy: boolean;
}) {
  const action =
    r.status === "referred"
      ? "arrival"
      : r.status === "arrived"
        ? "seen"
        : "outcome";
  const [time, setTime] = useState(eatInput(new Date(Date.now() + 1000)));
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState("assessment_completed");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await execute(action, {
      referral_id: r.id,
      expected_version: r.version,
      occurred_at: eatToIso(time),
      note,
      outcome,
    });
    if (result) {
      setNote("");
      setTime(eatInput(new Date(Date.now() + 1000)));
    }
  }
  if (w.profile.role !== "facility")
    return (
      <>
        <h1>Facility access required</h1>
        <p>Switch to the receiving facility team to record a handover.</p>
      </>
    );
  return (
    <>
      <PageHead title="Confirm the handover.">
        <span className="semibold">
          {r.code} · {r.alias}
        </span>
      </PageHead>
      {r.status === "closed" ? (
        <section className="card">
          <h2 className="success">Outcome recorded</h2>
          <p>The CHW notification was created with the outcome record.</p>
          <Button variant="neutral" onPress={() => go(`referral/${r.id}`)}>
            View referral history
          </Button>
        </section>
      ) : (
        <form onSubmit={submit} className="card stack">
          <InputField label="Next event" value={eventLabel[action]} readOnly />
          <InputField
            label="Event time (EAT / UTC+3)"
            type="datetime-local"
            step={1}
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          {action === "outcome" && (
            <SelectField
              label="Outcome category"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              <option value="assessment_completed">Assessment completed</option>
              <option value="adverse_outcome">Adverse outcome recorded</option>
              <option value="other">Other recorded outcome</option>
            </SelectField>
          )}
          <InputField
            label={action === "outcome" ? "Outcome note" : "Event note"}
            required={action === "outcome"}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Synthetic record only"
          />
          <p className="muted">
            {action === "outcome"
              ? "Recording an outcome creates a closure notification for the assigned CHW."
              : "Record arrival, then clinician contact, then an outcome. Each event is saved separately."}
          </p>
          <Button disabled={busy} type="submit">
            {busy
              ? "Saving…"
              : action === "outcome"
                ? "Record outcome & notify CHW"
                : action === "arrival"
                  ? "Confirm arrival"
                  : "Record clinician contact"}
          </Button>
        </form>
      )}
    </>
  );
}
function Notifications({
  workspace: w,
  execute,
  busy,
}: {
  workspace: Workspace;
  execute: Execute;
  busy: boolean;
}) {
  return (
    <>
      <PageHead title="An update for you." />
      {w.notifications.length === 0 ? (
        <div className="card">
          <h2>No updates yet.</h2>
          <p className="muted">Facility outcomes will appear here.</p>
        </div>
      ) : (
        w.notifications.map((n) => {
          const r = w.referrals.find((r) => r.id === n.referral_id);
          return (
            <section className="card closure" key={n.id}>
              <h2>Outcome recorded</h2>
              <p>
                {r?.alias} · {r?.code}
              </p>
              <p>
                The receiving team recorded an outcome at{" "}
                {w.facilities.find((f) => f.id === r?.facility_id)?.name}. View
                the note and plan the next follow-up.
              </p>
              <p className="small success">
                {n.acknowledged_at
                  ? `Acknowledged · ${formatTime(n.acknowledged_at)}`
                  : "Notification created · not yet acknowledged"}
              </p>
              <Button
                disabled={busy || !!n.acknowledged_at}
                onPress={() =>
                  void execute("acknowledge", { notification_id: n.id })
                }
              >
                {n.acknowledged_at ? "Acknowledged" : "Acknowledge update"}
              </Button>
              <a href={`#referral/${r?.id}`}>View referral history</a>
            </section>
          );
        })
      )}
      <Button variant="neutral" onPress={() => go("queue")}>
        Return to referrals
      </Button>
    </>
  );
}
function CountryContext({ actor }: { actor: string }) {
  const [data, setData] = useState<Context | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await getContext(actor));
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="card context">
      <h2>Country context</h2>
      <p className="small muted">
        Tanzania · Public national statistics, separate from this demo’s
        referral outcomes.
      </p>
      {data && data.status !== "unavailable" ? (
        <>
          <p className="small muted">
            {data.status === "cached"
              ? "Cached public data (up to one hour)"
              : "Live public data"}
          </p>
          <p>
            <strong>{data.value}</strong> per 100,000 live births · {data.year}
          </p>
          <p className="small muted">
            {data.indicator}. Retrieved {formatTime(data.retrieved_at)}.
          </p>
          <a
            href="https://data.worldbank.org/indicator/SH.STA.MMRT?locations=TZ"
            target="_blank"
            rel="noreferrer"
          >
            Source: World Bank
          </a>
        </>
      ) : (
        data && (
          <p className="small muted">
            The public source is unavailable. Referral records are unaffected.
          </p>
        )
      )}
      {error && (
        <p className="small" role="alert">
          {error}
        </p>
      )}
      <Button variant="neutral" onPress={() => void load()} disabled={loading}>
        {loading
          ? "Loading public data…"
          : data
            ? "Refresh country context"
            : "Load public context"}
      </Button>
    </section>
  );
}
function Login({ onError }: { onError: (error: string | null) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    onError(error?.message ?? null);
    setBusy(false);
  }
  return (
    <form className="card login stack" onSubmit={submit}>
      <h1>Sign in to TAFU</h1>
      <p className="muted">Use a provisioned demo team account.</p>
      <InputField
        label="Email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <InputField
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Button type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
