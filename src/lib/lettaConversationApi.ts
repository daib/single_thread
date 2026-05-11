import { APIError } from "@letta-ai/letta-client";
import {
  createLettaClient,
  lettaBaseUrl,
  lettaJsonHeaders,
} from "@/lib/lettaClient";
import { loadLettaEnvFile } from "@/lib/loadLettaEnvFile";

export type CreateLettaConversationResult =
  | { ok: true; id: string }
  | { ok: false; detail: string; status?: number };

export class LettaHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "LettaHttpError";
  }
}

function missingRequiredField(detailRaw: string, fieldName: string): boolean {
  if (!/field required/i.test(detailRaw)) return false;
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`['"]${escaped}['"]`, "i").test(detailRaw);
}

function parseIsolatedBlockLabelsFromEnv(): string[] {
  loadLettaEnvFile();
  const raw = process.env.LETTA_CONVERSATION_ISOLATED_BLOCK_LABELS?.trim() ?? "";
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function conversationIdFromUnknown(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (typeof o.id === "string" && o.id.trim()) return o.id.trim();
  return null;
}

export async function createLettaConversationForAgent(
  agentId: string,
): Promise<CreateLettaConversationResult> {
  const agent = agentId.trim();
  if (!agent) return { ok: false, detail: "Missing agent id." };

  try {
    const isolated = parseIsolatedBlockLabelsFromEnv();
    const conv = await createLettaClient().conversations.create({
      agent_id: agent,
      ...(isolated.length > 0 ? { isolated_block_labels: isolated } : {}),
    });
    const id = conversationIdFromUnknown(conv);
    if (id) return { ok: true, id };
    return { ok: false, detail: "Letta returned conversation payload without id." };
  } catch (e) {
    if (e instanceof APIError) {
      const raw = (() => {
        try {
          return JSON.stringify(e.error);
        } catch {
          return e.message;
        }
      })();
      return { ok: false, detail: raw.slice(0, 2000), status: e.status };
    }
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: detail.slice(0, 500) };
  }
}

export async function forkLettaConversation(
  sourceConversationId: string,
): Promise<CreateLettaConversationResult> {
  const sourceId = sourceConversationId.trim();
  if (!sourceId) return { ok: false, detail: "Missing source conversation id." };

  try {
    const conv = await createLettaClient().conversations.fork(sourceId, {});
    const id = conversationIdFromUnknown(conv);
    if (id) return { ok: true, id };
    return { ok: false, detail: "Letta returned fork payload without id." };
  } catch (e) {
    if (e instanceof APIError) {
      const raw = (() => {
        try {
          return JSON.stringify(e.error);
        } catch {
          return e.message;
        }
      })();
      return { ok: false, detail: raw.slice(0, 2000), status: e.status };
    }
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: detail.slice(0, 500) };
  }
}

/**
 * The SDK conversation create always streams SSE; use raw fetch for non-streaming JSON.
 */
export async function postLettaConversationMessageNonStreaming(
  conversationId: string,
  userText: string,
): Promise<unknown> {
  const base = lettaBaseUrl();
  const url = `${base}/v1/conversations/${encodeURIComponent(conversationId)}/messages`;
  const send = async (body: Record<string, unknown>): Promise<{ status: number; text: string }> => {
    const res = await fetch(url, {
      method: "POST",
      headers: lettaJsonHeaders(),
      body: JSON.stringify(body),
    });
    return { status: res.status, text: await res.text() };
  };

  // Most compatible across Letta versions: use `input` sugar (maps to a single user message).
  const first = await send({
    input: userText,
    streaming: false,
    use_assistant_message: true,
  });
  if (first.status >= 200 && first.status < 300) {
    try {
      return JSON.parse(first.text) as unknown;
    } catch {
      throw new LettaHttpError(first.status, `Non-JSON response (${first.text.slice(0, 200)})`);
    }
  }

  const firstTrim = first.text.trim();
  const shouldRetryWithText =
    first.status === 422 && missingRequiredField(firstTrim, "text");

  if (shouldRetryWithText) {
    const second = await send({
      messages: [{ role: "user", text: userText }],
      streaming: false,
      use_assistant_message: true,
    });
    if (second.status >= 200 && second.status < 300) {
      try {
        return JSON.parse(second.text) as unknown;
      } catch {
        throw new LettaHttpError(second.status, `Non-JSON response (${second.text.slice(0, 200)})`);
      }
    }
    throw new LettaHttpError(
      second.status,
      `${second.text.slice(0, 3000)} (retry after content-form failed with ${first.status})`,
    );
  }

  if (first.status === 422 && missingRequiredField(firstTrim, "content")) {
    const second = await send({
      messages: [{ role: "user", content: userText }],
      streaming: false,
      use_assistant_message: true,
    });
    if (second.status >= 200 && second.status < 300) {
      try {
        return JSON.parse(second.text) as unknown;
      } catch {
        throw new LettaHttpError(second.status, `Non-JSON response (${second.text.slice(0, 200)})`);
      }
    }
    throw new LettaHttpError(
      second.status,
      `${second.text.slice(0, 3000)} (retry after input-form failed with ${first.status})`,
    );
  }

  throw new LettaHttpError(first.status, first.text.slice(0, 4000));
}

export async function deleteLettaConversationBestEffort(conversationId: string): Promise<void> {
  const trimmed = conversationId.trim();
  if (!trimmed) return;
  const base = lettaBaseUrl();
  try {
    const res = await fetch(`${base}/v1/conversations/${encodeURIComponent(trimmed)}`, {
      method: "DELETE",
      headers: lettaJsonHeaders(),
    });
    if (!res.ok && res.status !== 404) {
      const t = await res.text();
      console.warn(
        "[lettaConversationApi] delete conversation",
        trimmed,
        res.status,
        t.slice(0, 400),
      );
    }
  } catch (e) {
    console.warn("[lettaConversationApi] delete conversation", trimmed, e);
  }
}
