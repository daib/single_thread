import { deleteLettaAgentById } from "@/lib/lettaCreateProfileAgent";
import { loadLettaEnvFile } from "@/lib/loadLettaEnvFile";
import { prisma } from "@/lib/prisma";

export type ReconcileLettaAgentsResult = {
  /** Agent ids removed from Letta */
  removed: string[];
  /** Agent ids deletion failed */
  failed: string[];
  /** Agents returned by Letta before reconcile */
  totalOnLetta: number;
  /** Distinct ids allowed (profiles + env fallbacks / keep list) */
  allowedCount: number;
};

function parseExtraKeepIds(): string[] {
  const raw = process.env.LETTA_AGENT_IDS_TO_KEEP?.trim();
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Deletes Letta agents whose ids are not referenced by any `AppProfile.lettaAgentId`,
 * excluding `LETTA_AGENT_ID` and optional `LETTA_AGENT_IDS_TO_KEEP`.
 */
export async function reconcileLettaAgentsWithProfiles(): Promise<ReconcileLettaAgentsResult> {
  loadLettaEnvFile();
  const baseRaw = process.env.LETTA_BASE_URL?.trim() || "http://127.0.0.1:8283";
  const base = baseRaw.replace(/\/$/, "");
  const apiKey = process.env.LETTA_API_KEY?.trim() || null;

  const listRes = await fetch(`${base}/v1/agents/`, {
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
  });

  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(
      `Letta list agents failed: ${listRes.status} ${text.slice(0, 400)}`,
    );
  }

  const agents = (await listRes.json()) as Array<{ id: string }>;

  const profiles = await prisma.appProfile.findMany({
    where: { lettaAgentId: { not: null } },
    select: { lettaAgentId: true },
  });

  const allowed = new Set<string>();
  for (const p of profiles) {
    const id = p.lettaAgentId?.trim();
    if (id) allowed.add(id);
  }

  const fallback = process.env.LETTA_AGENT_ID?.trim();
  if (fallback) allowed.add(fallback);

  for (const id of parseExtraKeepIds()) {
    allowed.add(id);
  }

  const removed: string[] = [];
  const failed: string[] = [];

  for (const { id } of agents) {
    if (allowed.has(id)) continue;
    const ok = await deleteLettaAgentById(id);
    if (ok) removed.push(id);
    else failed.push(id);
  }

  return {
    removed,
    failed,
    totalOnLetta: agents.length,
    allowedCount: allowed.size,
  };
}
