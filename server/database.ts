import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
export const actors = [
  { id: "10000000-0000-4000-8000-000000000001", name: "Maria · Supervisor" },
  { id: "10000000-0000-4000-8000-000000000002", name: "Grace · CHW" },
  { id: "10000000-0000-4000-8000-000000000003", name: "Neema · CHW" },
  {
    id: "10000000-0000-4000-8000-000000000004",
    name: "Receiving team · Highland",
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    name: "Receiving team · Valley",
  },
];
export async function openDatabase(path?: string) {
  const db = new PGlite(path);
  await db.waitReady;
  const { rows } = await db.query<{ exists: boolean }>(
    "select exists(select 1 from pg_tables where schemaname='public' and tablename='organizations')",
  );
  if (!rows[0].exists) {
    await db.transaction(async (tx) => {
      // Supabase supplies these roles/auth.uid(); the local-only harness supplies a compatible identity shim.
      await tx.exec(`create role anon; create role authenticated;
    create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to authenticated; grant execute on function auth.uid() to authenticated;`);
      await tx.exec(
        await readFile(
          fileURLToPath(
            new URL(
              "../supabase/migrations/202610150001_referral_loop.sql",
              import.meta.url,
            ),
          ),
          "utf8",
        ),
      );
      await tx.exec(
        await readFile(
          fileURLToPath(new URL("../supabase/seed.sql", import.meta.url)),
          "utf8",
        ),
      );
    });
  }
  return db;
}
export async function rpc(
  db: PGlite,
  actor: string,
  name: "get_workspace" | "apply_command",
  args?: { requestId: string; action: string; payload: unknown },
) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      actor,
    ]);
    await tx.exec("set local role authenticated");
    const query = args
      ? await tx.query<{ result: unknown }>(
          "select public.apply_command($1::uuid,$2,$3::jsonb) as result",
          [args.requestId, args.action, JSON.stringify(args.payload)],
        )
      : await tx.query<{ result: unknown }>(
          "select public.get_workspace() as result",
        );
    return query.rows[0].result;
  });
}
