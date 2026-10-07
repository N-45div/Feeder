import { describe, expect, it } from "vitest";
import { buildQuery, QlooClient, QlooError } from "./client";

function fakeClock() {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
    advance: (ms: number) => {
      t += ms;
    },
  };
}

async function caught(promise: Promise<unknown>): Promise<QlooError> {
  const error = await promise.catch((e: unknown) => e);
  if (!(error instanceof QlooError)) throw new Error("expected a QlooError");
  return error;
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("buildQuery", () => {
  it("joins arrays with commas and skips empty values", () => {
    const query = buildQuery({
      "filter.type": "urn:entity:movie",
      "signal.interests.entities": ["a", "b"],
      "filter.tags": [],
      take: 10,
      "feature.explainability": true,
      "filter.popularity.min": undefined,
      page: null,
    });
    expect(query).toBe(
      "filter.type=urn%3Aentity%3Amovie&signal.interests.entities=a%2Cb&take=10&feature.explainability=true",
    );
  });
});

describe("QlooClient", () => {
  it("sends the key as X-Api-Key to the hackathon base URL", async () => {
    const seen: { url: string; headers: HeadersInit | undefined }[] = [];
    const client = new QlooClient({
      apiKey: "test-key",
      fetchImpl: async (url, init) => {
        seen.push({ url: String(url), headers: init?.headers });
        return jsonResponse(200, { ok: true });
      },
    });
    await client.get("/search", { query: "Star Wars" });
    expect(seen[0].url).toBe("https://hackathon.api.qloo.com/search?query=Star+Wars");
    expect(seen[0].headers).toMatchObject({ "X-Api-Key": "test-key" });
  });

  it("never lets more than ratePerSecond requests start in one second", async () => {
    const clock = fakeClock();
    const startedAt: number[] = [];
    const client = new QlooClient({
      apiKey: "k",
      ratePerSecond: 3,
      now: clock.now,
      sleep: clock.sleep,
      fetchImpl: async () => {
        startedAt.push(clock.now());
        return jsonResponse(200, {});
      },
    });
    await Promise.all(Array.from({ length: 7 }, () => client.get("/v2/tags")));
    expect(startedAt).toHaveLength(7);
    for (let i = 3; i < startedAt.length; i++) {
      expect(startedAt[i] - startedAt[i - 3]).toBeGreaterThanOrEqual(1000);
    }
  });

  it("retries a 429, honouring Retry-After, then succeeds", async () => {
    const clock = fakeClock();
    const responses = [jsonResponse(429, { error: "slow down" }, { "retry-after": "2" }), jsonResponse(200, { ok: 1 })];
    const client = new QlooClient({
      apiKey: "k",
      now: clock.now,
      sleep: clock.sleep,
      fetchImpl: async () => responses.shift()!,
    });
    await expect(client.get("/v2/insights")).resolves.toEqual({ ok: 1 });
    expect(clock.now()).toBeGreaterThanOrEqual(2000);
  });

  it("does not retry a 400 and reports status and body", async () => {
    let calls = 0;
    const client = new QlooClient({
      apiKey: "k",
      fetchImpl: async () => {
        calls++;
        return jsonResponse(400, { error: "take must be <= 50" });
      },
    });
    const error = await caught(client.get("/v2/insights", { take: 99 }));
    expect(error.status).toBe(400);
    expect(error.body).toContain("take must be");
    expect(calls).toBe(1);
  });

  it("gives up after maxAttempts on repeated 5xx", async () => {
    const clock = fakeClock();
    let calls = 0;
    const client = new QlooClient({
      apiKey: "k",
      maxAttempts: 3,
      now: clock.now,
      sleep: clock.sleep,
      fetchImpl: async () => {
        calls++;
        return jsonResponse(503, {});
      },
    });
    const error = await caught(client.get("/v2/trending"));
    expect(error.status).toBe(503);
    expect(calls).toBe(3);
  });

  it("keeps the key out of error messages", async () => {
    const client = new QlooClient({
      apiKey: "secret-key-123",
      fetchImpl: async () => jsonResponse(401, { error: "unauthorized" }),
    });
    const error = await caught(client.get("/search", { query: "x" }));
    expect(`${error.message} ${error.body}`).not.toContain("secret-key-123");
  });
});
