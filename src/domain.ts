import { z } from "zod";
const nullableTime = z.string().nullable();
export const memberSchema = z.object({
  user_id: z.string(),
  org_id: z.string(),
  name: z.string(),
  role: z.enum(["supervisor", "chw", "facility"]),
  facility_id: z.string().nullable(),
  supervisor_id: z.string().nullable().optional(),
});
export const referralSchema = z.object({
  id: z.string(),
  code: z.string(),
  alias: z.string(),
  village: z.string(),
  facility_id: z.string(),
  chw_id: z.string(),
  note: z.string(),
  status: z.enum(["referred", "arrived", "seen", "closed"]),
  outcome: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  arrival_at: nullableTime,
  seen_at: nullableTime,
  outcome_at: nullableTime,
  follow_up_due: nullableTime,
  follow_up_owner: z.string().nullable(),
  follow_up_note: z.string().nullable(),
  version: z.number(),
});
export const workspaceSchema = z.object({
  profile: memberSchema,
  staff: z.array(memberSchema).default([]),
  workers: z.array(memberSchema),
  facilities: z.array(z.object({ id: z.string(), name: z.string() })),
  referrals: z.array(referralSchema),
  events: z.array(
    z.object({
      id: z.string(),
      referral_id: z.string(),
      actor_id: z.string(),
      kind: z.string(),
      note: z.string(),
      occurred_at: z.string(),
      recorded_at: z.string(),
    }),
  ),
  notifications: z.array(
    z.object({
      id: z.string(),
      referral_id: z.string(),
      recipient_id: z.string(),
      created_at: z.string(),
      acknowledged_at: nullableTime,
    }),
  ),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export type Referral = z.infer<typeof referralSchema>;
export type Command = {
  requestId: string;
  action:
    "create" | "follow_up" | "arrival" | "seen" | "outcome" | "acknowledge";
  payload: Record<string, unknown>;
};
export type Result = { referral_id: string; code: string };
export function metrics(referrals: Referral[], now = Date.now()) {
  return {
    open: referrals.filter((r) => r.status !== "closed").length,
    due: referrals.filter(
      (r) =>
        r.status !== "closed" &&
        r.follow_up_due &&
        Date.parse(r.follow_up_due) <= now,
    ).length,
    closed: referrals.filter((r) => r.status === "closed").length,
  };
}
export function isDue(r: Referral, now = Date.now()) {
  return (
    r.status !== "closed" &&
    !!r.follow_up_due &&
    Date.parse(r.follow_up_due) <= now
  );
}
export const statusLabel = {
  referred: "Arrival unconfirmed",
  arrived: "Arrived at facility",
  seen: "Clinician contact recorded",
  closed: "Outcome recorded",
};
export const eventLabel: Record<string, string> = {
  created: "Referral created",
  follow_up: "Follow-up recorded",
  arrival: "Arrival confirmed",
  seen: "Clinician contact recorded",
  outcome: "Outcome recorded",
};
export function formatTime(iso: string) {
  return (
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Dar_es_Salaam",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso)) + " EAT"
  );
}
export function eatInput(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
  return parts.replace(" ", "T").slice(0, 19);
}
export function eatToIso(input: string) {
  return new Date(
    input + (input.length === 16 ? ":00" : "") + "+03:00",
  ).toISOString();
}

export function staffProgress(workspace: Workspace, now = Date.now()) {
  return workspace.staff.map((member) => {
    const referrals = workspace.referrals.filter(
      (r) => r.chw_id === member.user_id,
    );
    const counts = metrics(referrals, now);
    const actions = workspace.events
      .filter((e) => e.actor_id === member.user_id)
      .sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at));
    return {
      member,
      referrals,
      assigned: referrals.length,
      ...counts,
      completion: referrals.length
        ? Math.round((counts.closed / referrals.length) * 100)
        : 0,
      lastAction: actions[0] ?? null,
    };
  });
}
