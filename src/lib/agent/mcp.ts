// Feeder as a remote MCP server, so any MCP client (Claude, ChatGPT, Cursor) can use the same tools as the in-page agent.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FEEDER_TOOLS } from "./registry";
import { FeederToolError } from "./tools";

const INSTRUCTIONS =
  "Feeder is for enrollment and admissions teams at four-year US universities. It shows where a university's brand pulls beyond its freshman " +
  "pipeline (state board), which metros to send recruiters to, and for each metro the high schools to visit, nearby rival colleges and what the " +
  "audience likes. Start with find_universities to get an id. Quote numbers as the tools give them; state-level pull was tested against federal " +
  "enrollment data, while metros and high schools are untested. Don't invent schools, states or numbers the tools didn't return.";

export async function toolResult(work: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    const out = await work();
    return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out as Record<string, unknown> };
  } catch (error) {
    if (error instanceof FeederToolError) return { content: [{ type: "text", text: error.message }], isError: true };
    console.error("[mcp] tool failed", error);
    return { content: [{ type: "text", text: "Feeder couldn't answer that just now. Please try again in a moment." }], isError: true };
  }
}

export function buildFeederServer(limited: string | null): McpServer {
  const server = new McpServer({ name: "feeder", title: "Feeder recruiting desk", version: "1.0.0" }, { instructions: INSTRUCTIONS });
  for (const [name, t] of Object.entries(FEEDER_TOOLS)) {
    // Nothing is written or deleted. A metro brief may call Qloo once and keep the answer, so it's marked open-world.
    const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: Boolean(t.live) };
    server.registerTool(name, { title: t.title, description: t.description, inputSchema: t.input, annotations }, (args: unknown) =>
      limited ? Promise.resolve({ content: [{ type: "text" as const, text: limited }], isError: true }) : toolResult(() => t.run(args as never)),
    );
  }
  return server;
}
