import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { workspaceSchema, type Command, type Result } from "./domain";
export const hosted = import.meta.env.VITE_BACKEND === "supabase";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configurationError =
  hosted && (!url || !key)
    ? "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local, then restart the app."
    : null;
export const supabase =
  hosted && !configurationError ? createClient(url, key) : null;
export type Actor = { id: string; name: string };
const actorSchema = z.array(z.object({ id: z.string(), name: z.string() }));
export const contextSchema = z.object({
  source: z.string(),
  url: z.string(),
  indicator: z.string(),
  retrieved_at: z.string(),
  status: z.enum(["live", "cached", "unavailable"]),
  value: z.number().nullable(),
  year: z.string().nullable(),
});
export type Context = z.infer<typeof contextSchema>;
async function local(path: string, actor?: string, command?: Command) {
  const response = await fetch("/api/" + path, {
    method: command ? "POST" : "GET",
    headers: {
      ...(actor ? { "X-Demo-Actor": actor } : {}),
      ...(command ? { "Content-Type": "application/json" } : {}),
    },
    body: command ? JSON.stringify(command) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}
export async function getActors() {
  return hosted ? [] : actorSchema.parse(await local("actors"));
}
export async function getWorkspace(actor: string) {
  if (hosted) {
    if (!supabase) throw new Error(configurationError!);
    const { data, error } = await supabase.rpc("get_workspace");
    if (error) throw new Error(error.message);
    return workspaceSchema.parse(data);
  }
  return workspaceSchema.parse(await local("workspace", actor));
}
export async function sendCommand(
  actor: string,
  command: Command,
): Promise<Result> {
  if (hosted) {
    if (!supabase) throw new Error(configurationError!);
    const { data, error } = await supabase.rpc("apply_command", {
      p_request_id: command.requestId,
      p_action: command.action,
      p_payload: command.payload,
    });
    if (error) throw new Error(error.message);
    return z.object({ referral_id: z.string(), code: z.string() }).parse(data);
  }
  return z
    .object({ referral_id: z.string(), code: z.string() })
    .parse(await local("command", actor, command));
}
export async function getContext(actor: string): Promise<Context> {
  if (hosted) {
    if (!supabase) throw new Error(configurationError!);
    const { data, error } = await supabase.functions.invoke("country-context");
    if (error) throw new Error("Country context is unavailable.");
    return contextSchema.parse(data);
  }
  return contextSchema.parse(await local("context", actor));
}
