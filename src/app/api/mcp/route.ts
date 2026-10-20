import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { after } from "next/server";
import { LIMITS, perAddress, take } from "@/lib/limits";
import { buildFeederServer } from "@/lib/agent/mcp";

/**
 * Remote MCP server (streamable HTTP at /api/mcp), no sign-in. Stateless: every POST gets a fresh server and transport and a plain
 * JSON answer, so any serverless instance can take any request. There is no server-to-client stream, so GET answers 405, which the
 * MCP spec allows.
 */

export const maxDuration = 30;

const CORS: Readonly<Record<string, string>> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, accept, authorization, mcp-protocol-version, mcp-session-id, last-event-id",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS)) headers.set(name, value);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function POST(request: Request): Promise<Response> {
  // Only tool calls count against the limit; listing tools and the handshake are free.
  const body = await request.clone().json().catch(() => null);
  const calls = (Array.isArray(body) ? body : [body]).some((m) => m?.method === "tools/call");
  const limited = calls && !(await take(perAddress("mcp", request.headers), LIMITS.mcpPerAddress)) ? `This endpoint answers ${LIMITS.mcpPerAddress} tool calls per address per day.` : null;
  const server = buildFeederServer(limited);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  after(() => server.close().catch(() => undefined));
  return withCors(response);
}

const notAllowed = () =>
  withCors(Response.json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. Send MCP messages as POST." }, id: null }, { status: 405, headers: { Allow: "POST, OPTIONS" } }));

export const GET = notAllowed;
export const DELETE = notAllowed;

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}
