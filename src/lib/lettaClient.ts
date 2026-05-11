import Letta from "@letta-ai/letta-client";
import { loadLettaEnvFile } from "@/lib/loadLettaEnvFile";

const DEFAULT_LETTA_BASE_URL = "http://127.0.0.1:8283";

function readLettaConnection(): { baseURL: string; apiKey: string | null } {
  loadLettaEnvFile();
  const raw = process.env.LETTA_BASE_URL?.trim() || DEFAULT_LETTA_BASE_URL;
  return {
    baseURL: raw.replace(/\/$/, ""),
    apiKey: process.env.LETTA_API_KEY?.trim() || null,
  };
}

/**
 * SDK client initialization aligned with the Letta quickstart:
 * `new Letta({ apiKey: process.env.LETTA_API_KEY })`
 * @see https://github.com/daib/letta#hello-world-example
 *
 * Self-hosted servers set `LETTA_BASE_URL` (default `http://127.0.0.1:8283`).
 */
export function createLettaClient(): Letta {
  const { baseURL, apiKey } = readLettaConnection();
  return new Letta({ baseURL, apiKey });
}

/** REST API origin with no trailing slash (for raw `fetch` helpers). */
export function lettaBaseUrl(): string {
  return readLettaConnection().baseURL;
}

/** Bearer token when Letta uses SECURE / cloud (`LETTA_API_KEY`). */
export function lettaApiKey(): string | null {
  return readLettaConnection().apiKey;
}

/** JSON request headers for direct REST calls (matches SDK auth). */
export function lettaJsonHeaders(): Record<string, string> {
  const apiKey = readLettaConnection().apiKey;
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}
