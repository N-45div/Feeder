import { convertToModelMessages, isStepCount, streamText, tool, type ToolSet, type UIMessage } from "ai";
import { FEEDER_TOOLS } from "@/lib/agent/registry";
import { FeederToolError } from "@/lib/agent/tools";
import { agentLimit } from "@/lib/limits";

/**
 * The agent behind "Ask Feeder": a model with Feeder's tools (the same ones /api/mcp serves), working for one university.
 * Every state, metro and school comes from a tool call; the model only picks the calls and writes the answer.
 */

export const maxDuration = 60;

const MODEL = "anthropic/claude-haiku-5.5";
const MAX_MESSAGES = 16;
const MAX_CHARS = 1200;

const tools: ToolSet = Object.fromEntries(
  Object.entries(FEEDER_TOOLS).map(([name, t]) => [
    name,
    tool({
      description: t.description,
      inputSchema: t.input,
      execute: async (input: unknown) => {
        try {
          return await t.run(input as never);
        } catch (error) {
          if (error instanceof FeederToolError) return { error: error.message };
          throw error;
        }
      },
    }),
  ]),
);

function instructions(u: { id: number; name: string }) {
  return [
    `You are Feeder, working for the enrollment and admissions team of ${u.name} (university id ${u.id}). Questions are about this university unless the user names another; use find_universities for others.`,
    "Get every fact from the tools: states, freshmen counts, metros, high schools and colleges. Never invent a school, a number or a place the tools didn't return. If the tools can't answer, say so.",
    "Call the tools first without announcing them, then lead with the answer and a short list. Say the state numbers come from Fall 2022 federal data and that metro and high-school suggestions are untested.",
    "When you draft outreach, base it on the metro brief's music and TV, and promise nothing about admission or aid.",
    "When someone asks where to find students for a programme, sport or interest, pick one well-known brand, show, film, artist or game such students would like and ask Qloo with audience_hotspots. Say which one you used, that Qloo was asked about people 24 and younger, and which metros rose compared with the university's own list.",
    "When you give a visit day, keep its access stop and say it is a large public school serving many low-income students, added on purpose, from federal data.",
    "Write plain text: no Markdown headings, tables or bold. Use '- ' for list items. Keep answers under 150 words unless asked for a draft.",
    "Never mention tools to the user, by name or as 'the tool'; speak as Feeder ('I planned the trips').",
    "Only help with recruiting work: where students come from, where to recruit, which schools to visit and what resonates there.",
  ].join("\n");
}

const textOf = (m: UIMessage) => m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { messages?: UIMessage[]; unitid?: number; name?: string } | null;
  const messages = body?.messages;
  const id = Number(body?.unitid);
  const name = String(body?.name ?? "").slice(0, 120);
  if (!Array.isArray(messages) || !messages.length || !Number.isInteger(id) || id <= 0 || !name) {
    return Response.json({ error: "Send messages, a unitid and a name." }, { status: 400 });
  }
  const last = messages[messages.length - 1];
  if (last.role !== "user" || textOf(last).length > MAX_CHARS) return Response.json({ error: `Keep a question under ${MAX_CHARS} characters.` }, { status: 400 });

  const limited = await agentLimit(request.headers);
  if (limited) return Response.json({ error: limited }, { status: 429 });

  const result = streamText({
    model: MODEL,
    instructions: instructions({ id, name }),
    messages: await convertToModelMessages(messages.slice(-MAX_MESSAGES), { tools, ignoreIncompleteToolCalls: true }),
    tools,
    stopWhen: isStepCount(6),
    reasoning: "none",
    maxOutputTokens: 1200,
  });
  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error("[agent] failed", error);
      return "Feeder couldn't finish that answer. Please try again.";
    },
  });
}
