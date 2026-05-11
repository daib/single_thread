const STATE_KEY = "__single_thread_reconcile_sched__" as const;

type SchedState = {
  interval?: ReturnType<typeof setInterval>;
  timeout?: ReturnType<typeof setTimeout>;
};

function getState(): SchedState {
  const g = globalThis as typeof globalThis & { [STATE_KEY]?: SchedState };
  if (!g[STATE_KEY]) g[STATE_KEY] = {};
  return g[STATE_KEY]!;
}

function clearSched() {
  const s = getState();
  if (s.interval) clearInterval(s.interval);
  if (s.timeout) clearTimeout(s.timeout);
  s.interval = undefined;
  s.timeout = undefined;
}

function reconcilePingUrl(): string {
  const explicit = process.env.RECONCILE_LETTA_PING_URL?.trim();
  if (explicit) return explicit;

  const base =
    process.env.RECONCILE_LETTA_BASE_URL?.trim().replace(/\/$/, "") ||
    `http://127.0.0.1:${process.env.PORT?.trim() || "3000"}`;
  return `${base}/api/cron/reconcile-letta-agents`;
}

/**
 * POST to the reconcile cron route (same host). Uses fetch only — no Prisma/fs in this bundle.
 */
async function pingReconcileCron(): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  const url = reconcilePingUrl();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
  });
  const body = await res.text();
  if (!res.ok) {
    console.warn("[reconcile-letta ping]", res.status, body.slice(0, 600));
    return;
  }
  console.log("[reconcile-letta ping]", body.slice(0, 600));
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  if (process.env.VERCEL) {
    console.warn(
      "[instrumentation] In-process reconcile scheduling is disabled on Vercel; use an external cron hitting POST /api/cron/reconcile-letta-agents.",
    );
    return;
  }

  const msRaw = process.env.RECONCILE_LETTA_INTERVAL_MS?.trim();
  if (!msRaw) {
    return;
  }

  const ms = Number(msRaw);
  if (!Number.isFinite(ms) || ms < 60_000) {
    console.warn(
      "[instrumentation] RECONCILE_LETTA_INTERVAL_MS must be a number >= 60000",
    );
    return;
  }

  clearSched();
  const s = getState();

  const initialDelayRaw = process.env.RECONCILE_LETTA_INITIAL_DELAY_MS?.trim();
  const initialDelayMs =
    initialDelayRaw != null && initialDelayRaw !== ""
      ? Number(initialDelayRaw)
      : 15_000;
  const delay =
    Number.isFinite(initialDelayMs) && initialDelayMs >= 0
      ? initialDelayMs
      : 15_000;

  const tick = () => {
    void pingReconcileCron().catch((e) => console.error("[reconcile-letta]", e));
  };

  s.timeout = setTimeout(() => {
    tick();
    s.interval = setInterval(tick, ms);
  }, delay);

  console.log(
    `[instrumentation] Letta reconcile ping every ${ms} ms → ${reconcilePingUrl()} (first after ${delay} ms)`,
  );
}
