import {
  Activity,
  Bell,
  ChevronDown,
  ClipboardList,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  UsersRound,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Avatar, Button } from "./primitives";
import type { Workspace } from "./domain";
import type { Actor } from "./api";
export function DashboardShell({
  children,
  workspace,
  kind,
  actors,
  actor,
  busy,
  loading,
  onActor,
  onRefresh,
  onSignOut,
  query,
  onQuery,
}: {
  children: ReactNode;
  workspace: Workspace | null;
  kind: string;
  actors: Actor[];
  actor: string;
  busy: boolean;
  loading: boolean;
  onActor: (id: string) => void;
  onRefresh: () => void;
  onSignOut: () => void;
  query: string;
  onQuery: (v: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const profile = workspace?.profile;
  const supervisor = profile?.role === "supervisor";
  const links = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "queue", label: "Referrals", icon: ClipboardList },
    ...(supervisor ? [{ id: "team", label: "My team", icon: UsersRound }] : []),
    { id: "activity", label: "Activity", icon: Activity },
    ...(profile?.role === "chw"
      ? [
          {
            id: "notifications",
            label: `Updates · ${workspace!.notifications.filter((n) => !n.acknowledged_at).length}`,
            icon: Bell,
          },
        ]
      : []),
  ];
  const active =
    kind === "staff"
      ? "team"
      : kind === "referral" || kind === "facility" || kind === "new"
        ? "queue"
        : kind;
  return (
    <div className={`dashboard-shell ${profile ? "" : "signed-out"}`}>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById("main-content");
          main?.focus();
          main?.scrollIntoView();
        }}
      >
        Skip to content
      </a>
      {profile && (
        <aside className="sidebar">
          <a className="wordmark" href="#overview" aria-label="TAFU home">
            <HeartPulse size={20} />
            <span>TAFU</span>
          </a>
          <p className="small muted sidebar-tagline">Care, connected.</p>
          <nav aria-label="Primary navigation">
            {links.map((item) => (
              <a
                href={`#${item.id}`}
                key={item.id}
                aria-label={item.label}
                title={item.label}
                aria-current={active === item.id ? "page" : undefined}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </a>
            ))}
          </nav>
          <div className="workspace-summary">
            <strong>Lushoto District</strong>
            <p className="small muted">Synthetic workspace</p>
            <span className="workspace-indicator">Demo data only</span>
          </div>
        </aside>
      )}
      <div className="application-body">
        <header className="topbar">
          <a
            className="wordmark compact-brand"
            href="#overview"
            aria-label="TAFU home"
          >
            <HeartPulse size={20} />
            <span>TAFU</span>
          </a>
          <div className="breadcrumb small muted">
            Workspace <span>/</span>{" "}
            {active === "queue"
              ? "Referrals"
              : active === "team"
                ? "My team"
                : active === "activity"
                  ? "Activity"
                  : active === "notifications"
                    ? "Updates"
                    : "Overview"}
          </div>
          <form
            className="top-search search-field"
            onSubmit={(e) => {
              e.preventDefault();
              location.hash = "queue";
            }}
          >
            <Search size={18} />
            <input
              aria-label="Search referrals or staff"
              placeholder="Search referrals or staff"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
            />
          </form>
          {profile && (
            <div className="topbar-actions">
              <button
                className="icon-button"
                onClick={onRefresh}
                disabled={busy || loading}
                aria-label="Refresh records"
                title="Refresh records"
              >
                <RefreshCw size={20} className={loading ? "spinning" : ""} />
              </button>
              <a
                className="icon-button"
                href={profile.role === "chw" ? "#notifications" : "#activity"}
                aria-label={
                  profile.role === "chw" ? "Your updates" : "Recorded activity"
                }
              >
                <Bell size={20} />
              </a>
              <div className="profile-container">
                <button
                  className="profile-button"
                  aria-expanded={menu}
                  aria-label="Profile and demo access"
                  onClick={() => setMenu(!menu)}
                >
                  <Avatar initials={profile.name[0]} />
                  <span className="profile-name">{profile.name}</span>
                  <ChevronDown size={15} />
                </button>
                {menu && (
                  <div className="profile-menu">
                    <strong>{profile.name}</strong>
                    <p className="small muted">
                      {profile.role === "chw"
                        ? "Community health worker"
                        : profile.role === "supervisor"
                          ? "Supervisor"
                          : "Receiving team"}
                    </p>
                    {actors.length > 0 ? (
                      <label className="field small">
                        Demo team member
                        <select
                          aria-label="Demo team member"
                          value={actor}
                          disabled={busy || loading}
                          onChange={(e) => {
                            onActor(e.target.value);
                            setMenu(false);
                          }}
                        >
                          {actors.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <Button
                        variant="neutral"
                        disabled={busy || loading}
                        onPress={onSignOut}
                      >
                        <LogOut size={16} />
                        Sign out
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </header>
        {children}
      </div>
      {profile && (
        <nav className="mobile-navigation" aria-label="Mobile navigation">
          {links.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-label={item.label}
              aria-current={active === item.id ? "page" : undefined}
            >
              <item.icon size={20} />
              <span>
                {item.id === "overview"
                  ? "Home"
                  : item.id === "queue"
                    ? "Cases"
                    : item.id === "team"
                      ? "Team"
                      : item.id === "notifications"
                        ? "Updates"
                        : "Activity"}
              </span>
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
