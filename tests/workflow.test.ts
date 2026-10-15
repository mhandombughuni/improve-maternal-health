import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { actors, openDatabase, rpc } from "../server/database";
import { workspaceSchema, metrics, staffProgress } from "../src/domain";
let db: PGlite;
const supervisor = actors[0].id,
  chw = actors[1].id,
  otherChw = actors[2].id,
  facility = actors[3].id,
  otherFacility = actors[4].id;
const highland = "20000000-0000-4000-8000-000000000001";
const command = (
  actor: string,
  action: string,
  payload: Record<string, unknown>,
  requestId = randomUUID(),
) => rpc(db, actor, "apply_command", { requestId, action, payload });
const workspace = async (actor: string) =>
  workspaceSchema.parse(await rpc(db, actor, "get_workspace"));
beforeAll(async () => {
  db = await openDatabase();
});
afterAll(async () => {
  await db?.close();
});
describe("shared referral workflow", () => {
  it("seeds consistent metrics and restricts each role to assigned referrals", async () => {
    const all = await workspace(supervisor);
    expect(metrics(all.referrals)).toEqual({ open: 8, due: 3, closed: 4 });
    const own = await workspace(chw);
    expect(own.referrals.length).toBe(6);
    expect(own.referrals.every((r) => r.chw_id === chw)).toBe(true);
    const receiving = await workspace(facility);
    expect(receiving.referrals.every((r) => r.facility_id === highland)).toBe(
      true,
    );
  });
  it("persists one creation across retries, rejects changed input and trims user fields", async () => {
    const payload = {
      alias: " Demo mother ",
      village: " Mlalo ",
      facility_id: highland,
      chw_id: chw,
      note: "Synthetic referral",
    };
    const id = randomUUID();
    const first = await command(chw, "create", payload, id);
    expect(await command(chw, "create", payload, id)).toEqual(first);
    await expect(
      command(chw, "create", { ...payload, alias: "Different" }, id),
    ).rejects.toThrow(/different input/);
    const records = (await workspace(supervisor)).referrals.filter(
      (r) => r.alias === "Demo mother",
    );
    expect(records).toHaveLength(1);
    expect(records[0].village).toBe("Mlalo");
  });
  it("records follow-up then arrival/contact/outcome, creates one CHW notification, and acknowledges it", async () => {
    const created = (await command(supervisor, "create", {
      alias: "Journey",
      village: "Mlalo",
      facility_id: highland,
      chw_id: chw,
      note: "Synthetic journey",
    })) as { referral_id: string };
    let r = (await workspace(supervisor)).referrals.find(
      (r) => r.id === created.referral_id,
    )!;
    await command(supervisor, "follow_up", {
      referral_id: r.id,
      expected_version: r.version,
      note: "Call Grace",
      due_at: new Date(Date.now() + 3600000).toISOString(),
    });
    r = (await workspace(supervisor)).referrals.find((x) => x.id === r.id)!;
    expect(r.version).toBe(2);
    expect(r.follow_up_owner).toBe("Maria");
    await expect(
      command(supervisor, "arrival", {
        referral_id: r.id,
        expected_version: r.version,
        occurred_at: new Date().toISOString(),
      }),
    ).rejects.toThrow(/Only receiving facility/);
    await expect(
      command(otherChw, "follow_up", {
        referral_id: r.id,
        expected_version: r.version,
        note: "Unauthorized",
        due_at: new Date(Date.now() + 3600000).toISOString(),
      }),
    ).rejects.toThrow(/not available/);
    await expect(
      command(otherFacility, "arrival", {
        referral_id: r.id,
        expected_version: r.version,
        occurred_at: new Date().toISOString(),
      }),
    ).rejects.toThrow(/not available/);
    await expect(
      command(facility, "outcome", {
        referral_id: r.id,
        expected_version: r.version,
        occurred_at: new Date().toISOString(),
        note: "Too early",
        outcome: "assessment_completed",
      }),
    ).rejects.toThrow(/Invalid event order/);
    for (const action of ["arrival", "seen", "outcome"]) {
      r = (await workspace(facility)).referrals.find((x) => x.id === r.id)!;
      const payload = {
        referral_id: r.id,
        expected_version: r.version,
        occurred_at: new Date().toISOString(),
        note: "Synthetic facility confirmation",
        outcome: "adverse_outcome",
      };
      const id = randomUUID();
      await command(facility, action, payload, id);
      await command(facility, action, payload, id);
    }
    const closed = (await workspace(supervisor)).referrals.find(
      (x) => x.id === r.id,
    )!;
    expect(closed.status).toBe("closed");
    expect(closed.outcome).toBe("adverse_outcome");
    expect(closed.follow_up_due).toBeNull();
    const own = await workspace(chw);
    const notification = own.notifications.filter(
      (n) => n.referral_id === r.id,
    );
    expect(notification).toHaveLength(1);
    expect((await workspace(supervisor)).notifications).toHaveLength(0);
    await expect(
      command(otherChw, "acknowledge", { notification_id: notification[0].id }),
    ).rejects.toThrow(/not available/);
    await command(chw, "acknowledge", { notification_id: notification[0].id });
    expect(
      (await workspace(chw)).notifications.find(
        (n) => n.id === notification[0].id,
      )?.acknowledged_at,
    ).not.toBeNull();
    expect(
      own.events.filter((e) => e.referral_id === r.id).map((e) => e.kind),
    ).toEqual(["created", "follow_up", "arrival", "seen", "outcome"]);
  });
  it("rejects stale updates, future events, blank notes, and invalid facility assignments", async () => {
    const r = (await workspace(facility)).referrals.find(
      (r) => r.status === "referred",
    )!;
    await expect(
      command(facility, "arrival", {
        referral_id: r.id,
        expected_version: 0,
        occurred_at: new Date().toISOString(),
      }),
    ).rejects.toThrow(/changed/);
    await expect(
      command(facility, "arrival", {
        referral_id: r.id,
        expected_version: r.version,
        occurred_at: new Date(Date.now() + 3600000).toISOString(),
      }),
    ).rejects.toThrow(/not in the future/);
    await expect(
      command(supervisor, "create", {
        alias: "",
        village: "Mlalo",
        facility_id: highland,
        chw_id: chw,
        note: "x",
      }),
    ).rejects.toThrow(/required/);
    await expect(
      command(supervisor, "create", {
        alias: "Alias",
        village: "Mlalo",
        facility_id: randomUUID(),
        chw_id: chw,
        note: "x",
      }),
    ).rejects.toThrow(/Invalid facility/);
    await expect(
      command(facility, "create", {
        alias: "Alias",
        village: "Mlalo",
        facility_id: highland,
        chw_id: chw,
        note: "x",
      }),
    ).rejects.toThrow(/Only CHWs/);
  });
  it("prevents direct writes and isolates an unrelated organization even in RPCs", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
          supervisor,
        ]);
        await tx.exec("set local role authenticated");
        await tx.exec("update public.referrals set status='closed'");
      }),
    ).rejects.toThrow(/permission denied/);
    const outsider = randomUUID();
    const org = randomUUID();
    await db.query("insert into public.organizations values($1,$2)", [
      org,
      "Other demo team",
    ]);
    await db.query(
      "insert into public.memberships(user_id,org_id,name,role) values($1,$2,$3,$4)",
      [outsider, org, "Other supervisor", "supervisor"],
    );
    const w = await workspace(outsider);
    expect(w.referrals).toHaveLength(0);
    expect(w.events).toHaveLength(0);
    expect(w.facilities).toHaveLength(0);
    const r = (await workspace(supervisor)).referrals[0];
    await expect(
      command(outsider, "follow_up", {
        referral_id: r.id,
        expected_version: r.version,
        note: "Cross-org",
        due_at: new Date(Date.now() + 3600000).toISOString(),
      }),
    ).rejects.toThrow(/not available/);
    await expect(workspace(randomUUID())).rejects.toThrow(/No TAFU membership/);
  });
});

it("returns only direct reports and separates recorded staff activity from case outcomes", async () => {
  let w = await workspace(supervisor);
  expect(w.staff.map((s) => s.user_id).sort()).toEqual([chw, otherChw].sort());
  expect((await workspace(chw)).staff).toHaveLength(0);
  expect((await workspace(facility)).staff).toHaveLength(0);
  const org = w.profile.org_id;
  const unassigned = randomUUID();
  await db.query(
    "insert into public.memberships(user_id,org_id,name,role) values($1,$2,$3,$4)",
    [unassigned, org, "Unassigned worker", "chw"],
  );
  w = await workspace(supervisor);
  expect(w.staff.some((s) => s.user_id === unassigned)).toBe(false);
  const progress = staffProgress(w).find((s) => s.member.user_id === chw)!;
  expect(progress.assigned).toBe(
    w.referrals.filter((r) => r.chw_id === chw).length,
  );
  expect(progress.closed).toBe(
    w.referrals.filter((r) => r.chw_id === chw && r.status === "closed").length,
  );
  expect(progress.lastAction?.actor_id).toBe(chw);
  await expect(
    db.query(
      "update public.memberships set supervisor_id=$1 where user_id=$2",
      [facility, chw],
    ),
  ).rejects.toThrow(/Supervisor must/);
  const otherOrg = randomUUID(),
    otherSupervisor = randomUUID();
  await db.query("insert into public.organizations values($1,$2)", [
    otherOrg,
    "Separate reporting line",
  ]);
  await db.query(
    "insert into public.memberships(user_id,org_id,name,role) values($1,$2,$3,'supervisor')",
    [otherSupervisor, otherOrg, "Separate supervisor"],
  );
  await expect(
    db.query(
      "update public.memberships set supervisor_id=$1 where user_id=$2",
      [otherSupervisor, chw],
    ),
  ).rejects.toThrow(/same organization/);
  expect((await workspace(otherSupervisor)).staff).toHaveLength(0);
});
