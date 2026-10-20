"use client";

import { useState, useSyncExternalStore } from "react";

const noop = () => () => {};

/** The MCP address for whichever host serves the page, with a copy button. */
export function McpUrl() {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const [copied, setCopied] = useState(false);
  const url = `${origin}/api/mcp`;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2.5">
      <code className="rounded-xl bg-[#0f0b20] px-4 py-2.5 text-[15px] text-[#ffb89c]">{url}</code>
      <button
        type="button"
        onClick={() => void navigator.clipboard?.writeText(url).then(() => setCopied(true))}
        className="press card-sm min-h-11 rounded-full bg-pennant px-4 text-sm font-bold text-ink"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
