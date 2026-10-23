// The server's Qloo client, built from the environment on first use. Shared by metro briefs and the agent's live tool.

import { QlooClient } from "./client";

let client: QlooClient | null = null;

export function qloo(): QlooClient {
  if (!client) {
    const apiKey = process.env.QLOO_API_KEY;
    if (!apiKey) throw new Error("QLOO_API_KEY is not set");
    client = new QlooClient({ apiKey, baseUrl: process.env.QLOO_BASE_URL, maxAttempts: 4 });
  }
  return client;
}
