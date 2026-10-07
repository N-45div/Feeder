// Minimal Qloo REST client: GET only, server-side only.
// Hackathon keys work solely on https://hackathon.api.qloo.com with an X-Api-Key header.

export type ParamValue = string | number | boolean | Array<string | number> | undefined | null;
export type QueryParams = Record<string, ParamValue>;

export interface QlooClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Requests allowed to start in any rolling one-second window. Bursts of 6 get a 429. */
  ratePerSecond?: number;
  timeoutMs?: number;
  maxAttempts?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class QlooError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly path: string,
    readonly body?: string,
  ) {
    super(message);
    this.name = "QlooError";
  }
}

export const DEFAULT_BASE_URL = "https://hackathon.api.qloo.com";

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export function buildQuery(params: QueryParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      search.set(key, value.join(","));
    } else {
      search.set(key, String(value));
    }
  }
  return search.toString();
}

export class QlooClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly ratePerSecond: number;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly starts: number[] = [];
  private gate: Promise<void> = Promise.resolve();

  constructor(options: QlooClientOptions) {
    if (!options.apiKey) throw new Error("QlooClient needs an API key");
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.ratePerSecond = options.ratePerSecond ?? 3;
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async get<T = unknown>(path: string, params: QueryParams = {}): Promise<T> {
    const query = buildQuery(params);
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}${query ? `?${query}` : ""}`;

    let lastError: QlooError | null = null;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      await this.acquireSlot();
      let response: Response;
      try {
        response = await this.fetchWithTimeout(url);
      } catch (error) {
        const reason = error instanceof Error && error.name === "AbortError" ? "timed out" : "network error";
        lastError = new QlooError(`Qloo ${path} ${reason}`, null, path);
        if (attempt < this.maxAttempts) await this.sleep(backoffMs(attempt));
        continue;
      }

      if (response.ok) return (await response.json()) as T;

      const body = (await response.text()).slice(0, 500);
      lastError = new QlooError(`Qloo ${path} returned ${response.status}`, response.status, path, body);
      if (!RETRYABLE.has(response.status) || attempt === this.maxAttempts) break;
      await this.sleep(retryAfterMs(response) ?? backoffMs(attempt));
    }
    throw lastError ?? new QlooError(`Qloo ${path} failed`, null, path);
  }

  // Serialises request starts so no more than ratePerSecond begin in any rolling second.
  private acquireSlot(): Promise<void> {
    const next = this.gate.then(async () => {
      for (;;) {
        const cutoff = this.now() - 1000;
        while (this.starts.length && this.starts[0] <= cutoff) this.starts.shift();
        if (this.starts.length < this.ratePerSecond) break;
        await this.sleep(this.starts[0] - cutoff);
      }
      this.starts.push(this.now());
    });
    this.gate = next.catch(() => undefined);
    return next;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, {
        method: "GET",
        headers: { "X-Api-Key": this.apiKey, Accept: "application/json" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

function backoffMs(attempt: number): number {
  return 500 * 3 ** (attempt - 1);
}

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}
