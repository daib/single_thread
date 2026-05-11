import type { ChatProfileOption, Conversation } from "@/types";

export const EXPORT_FORMAT_VERSION = "single-thread-chat/v1" as const;

export type ConversationExportV1 = {
  exportedAt: string;
  format: typeof EXPORT_FORMAT_VERSION;
  profile: { id: string; displayName: string; handle: string } | null;
  conversation: Conversation;
};

export function buildConversationExport(
  conversation: Conversation,
  profile?: ChatProfileOption | null,
): ConversationExportV1 {
  return {
    exportedAt: new Date().toISOString(),
    format: EXPORT_FORMAT_VERSION,
    profile: profile
      ? { id: profile.id, displayName: profile.displayName, handle: profile.handle }
      : null,
    conversation,
  };
}

/** Safe ASCII-ish filename segment for downloads. */
export function safeDownloadFilename(title: string, id: string): string {
  const base = title
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const shortId = id.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "thread";
  return `${base || "conversation"}-${shortId}.json`;
}

/** Triggers a browser download of the conversation as JSON (client-only). */
export function downloadConversationJson(
  conversation: Conversation,
  profile?: ChatProfileOption | null,
): void {
  if (typeof document === "undefined") return;
  const payload = buildConversationExport(conversation, profile);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeDownloadFilename(conversation.title, conversation.id);
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}
