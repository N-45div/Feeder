// Daily limits for the public demo, counted in Postgres so every serverless instance shares them.
// Addresses are stored only as salted hashes, and only for the day.

import { createHash } from "node:crypto";
import { sql } from "./db";

export const LIMITS = {
  /** Metro briefs per address per day. Cached briefs are free to serve but still count, to keep it simple. */
  briefPerAddress: 120,
  /** New briefs fetched from Qloo by everyone per day (each costs about six Qloo calls). */
  freshBriefsPerDay: 400,
  /** Questions to the agent, per address and overall, per day. */
  agentPerAddress: 25,
  agentPerDay: 250,
  /** MCP tool calls per address per day. */
  mcpPerAddress: 600,
};

export function addressOf(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

const hashed = (address: string) => createHash("sha256").update(`feeder:${address}`).digest("hex").slice(0, 24);

/** Counts one use against a key for today; false once today's count passes the limit. */
export async function take(key: string, limit: number): Promise<boolean> {
  const [row] = (await sql()`insert into usage_counts (key, day, count) values (${key}, current_date, 1)
    on conflict (key, day) do update set count = usage_counts.count + 1 returning count`) as { count: number }[];
  return row.count <= limit;
}

export const perAddress = (kind: string, headers: Headers) => `${kind}:${hashed(addressOf(headers))}`;

export async function agentLimit(headers: Headers): Promise<string | null> {
  if (!(await take(perAddress("agent", headers), LIMITS.agentPerAddress))) return `This demo answers ${LIMITS.agentPerAddress} questions per visitor per day. The desk pages and the MCP endpoint still work.`;
  if (!(await take("agent:all", LIMITS.agentPerDay))) return "The demo's question budget for today is used up. The desk pages and the MCP endpoint still work.";
  return null;
}
