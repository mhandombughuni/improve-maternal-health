import type { Plugin, Connect } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdir } from "node:fs/promises";
import { actors, openDatabase, rpc } from "./database";
import { z } from "zod";
const command = z.object({
  requestId: z.uuid(),
  action: z.enum([
    "create",
    "follow_up",
    "arrival",
    "seen",
    "outcome",
    "acknowledge",
  ]),
  payload: z.record(z.string(), z.unknown()),
});
let database: ReturnType<typeof openDatabase> | undefined;
async function db() {
  if (!database) {
    await mkdir(".local", { recursive: true });
    database = openDatabase(".local/tafu-pg");
  }
  return database;
}
function json(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(data));
}
async function body(req: IncomingMessage) {
  let input = "";
  for await (const chunk of req) {
    input += chunk;
    if (Buffer.byteLength(input) > 16_384) throw new Error("Request too large");
  }
  return JSON.parse(input);
}
let contextCache: { at: number; data: Record<string, unknown> } | undefined;
async function countryContext() {
  if (contextCache && Date.now() - contextCache.at < 3_600_000)
    return { ...contextCache.data, status: "cached" };
  const url =
    "https://api.worldbank.org/v2/country/TZA/indicator/SH.STA.MMRT?format=json&mrnev=5";
  const source = {
    source: "World Bank Indicators API",
    url,
    indicator:
      "Maternal mortality ratio (modeled estimate, per 100,000 live births)",
    retrieved_at: new Date().toISOString(),
  };
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error("Source unavailable");
    const data = await response.json();
    const rows = z
      .tuple([
        z.unknown(),
        z.array(
          z.object({
            date: z.string(),
            value: z.number().nullable(),
            indicator: z.object({ id: z.literal("SH.STA.MMRT") }),
          }),
        ),
      ])
      .parse(data)[1];
    const row = rows
      .filter((r) => r.value !== null)
      .sort((a, b) => Number(b.date) - Number(a.date))[0];
    if (!row) throw new Error("No observations");
    const result = {
      ...source,
      status: "live",
      value: row.value,
      year: row.date,
    };
    contextCache = { at: Date.now(), data: result };
    return result;
  } catch {
    return { ...source, status: "unavailable", value: null, year: null };
  }
}
async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
) {
  if (!req.url?.startsWith("/api/")) return next();
  // This demo identity selector is deliberately restricted to loopback requests.
  const remote = req.socket.remoteAddress;
  const host = req.headers.host ?? "";
  if (
    !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote ?? "") ||
    !/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)
  )
    return json(res, 403, { error: "The synthetic demo API is local-only." });
  if (req.headers.origin && req.headers.origin !== `http://${host}`)
    return json(res, 403, { error: "Cross-origin request rejected." });
  try {
    if (req.url === "/api/actors" && req.method === "GET")
      return json(res, 200, actors);
    const actor = req.headers["x-demo-actor"];
    if (typeof actor !== "string" || !actors.some((a) => a.id === actor))
      return json(res, 401, { error: "Select a demo team member." });
    if (req.url === "/api/context" && req.method === "GET")
      return json(res, 200, await countryContext());
    if (req.url === "/api/workspace" && req.method === "GET")
      return json(res, 200, await rpc(await db(), actor, "get_workspace"));
    if (req.url === "/api/command" && req.method === "POST") {
      const input = command.parse(await body(req));
      return json(
        res,
        200,
        await rpc(await db(), actor, "apply_command", input),
      );
    }
    return json(res, 404, { error: "Unknown API operation." });
  } catch (error) {
    const e = error as Error & { code?: string };
    const status = e.code === "42501" ? 403 : e.code === "40001" ? 409 : 400;
    json(res, status, {
      error:
        e instanceof z.ZodError ? "Check the submitted fields." : e.message,
    });
  }
}
export function localApi(enabled: boolean): Plugin {
  return {
    name: "tafu-local-demo-api",
    configureServer(server) {
      if (enabled)
        server.middlewares.use((req, res, next) => {
          void handle(req, res, next);
        });
    },
    configurePreviewServer(server) {
      if (enabled)
        server.middlewares.use((req, res, next) => {
          void handle(req, res, next);
        });
    },
  };
}
