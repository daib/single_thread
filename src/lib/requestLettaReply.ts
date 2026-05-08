"use client";

/**
 * Calls `/api/letta/send` and returns text to show as the assistant bubble.
 * When Letta is disabled (204), returns a setup hint instead of a fake demo reply.
 * Returns empty string when there is nothing user-visible (null / Python None).
 */
export async function requestLettaReply(userText: string): Promise<string> {
  const trimmed = userText.trim();
  if (!trimmed) {
    return "Message was empty.";
  }

  const res = await fetch("/api/letta/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: trimmed }),
  });

  if (res.status === 204) {
    return "Letta agent id is missing. Add LETTA_AGENT_ID to `.env` or `.env.letta` (copy from `.env.letta.example`), then restart `next dev`. Ensure `docker compose up letta` is running.";
  }

  const data = (await res.json().catch(() => ({}))) as {
    reply?: string | null;
    hint?: string;
    error?: string;
    detail?: string;
    lettaStatus?: number;
  };

  if (!res.ok) {
    const bits = [data.error ?? `HTTP ${res.status}`];
    if (data.detail) bits.push(data.detail);
    if (data.lettaStatus != null && data.lettaStatus !== 0) {
      bits.push(`(Letta HTTP ${data.lettaStatus})`);
    }
    return bits.filter(Boolean).join(" — ");
  }

  if (data.reply === undefined || data.reply === null) {
    return "";
  }
  if (typeof data.reply === "string") {
    const t = data.reply.trim();
    if (!t || /^(none|null)$/i.test(t)) {
      return "";
    }
    return t;
  }

  const tail = data.hint ? ` ${data.hint}` : "";
  return `Letta returned no assistant text.${tail}`.trim();
}
