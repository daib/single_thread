import { loadLettaEnvFile } from "@/lib/loadLettaEnvFile";

/** Self-hosted Letta uses `CreateAgent` (OpenAPI), not the cloud-style `model` / `embedding` fields the Node SDK sends to the same path. */
type CreateAgentBody = {
  name: string;
  agent_type?: "memgpt_agent" | "split_thread_agent" | "o1_agent";
  llm_config: {
    model: string;
    model_endpoint_type: string;
    model_endpoint?: string | null;
    context_window: number;
  };
  embedding_config: {
    embedding_endpoint_type: string;
    embedding_endpoint?: string | null;
    embedding_model: string;
    embedding_dim: number;
  };
  memory: {
    memory: Record<
      string,
      { label: string; value?: string | null; limit?: number }
    >;
  };
};

/** Letta rejects names with e.g. parentheses; slug uses letters, digits, `-`. */
function sanitizeLettaAgentName(displayName: string, profileId: string): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = profileId.replace(/-/g, "").slice(0, 8);
  const base = slug.length > 0 ? slug : "profile";
  const name = `${base}-${suffix}`;
  return name.slice(0, 120);
}

/** Strip `provider/` prefix from handles like `openai/gpt-4o-mini` for self-hosted `LLMConfig.model`. */
function normalizeLlmModel(handle: string): string {
  const t = handle.trim();
  const i = t.lastIndexOf("/");
  return i >= 0 ? t.slice(i + 1) : t;
}

function normalizeEmbeddingModel(handle: string): string {
  return normalizeLlmModel(handle);
}

/**
 * Creates a dedicated Letta agent for a profile (self-hosted `CreateAgent` schema).
 * Returns null if Letta is unreachable or creation fails.
 */
export async function createLettaAgentForProfile(opts: {
  displayName: string;
  profileId: string;
}): Promise<string | null> {
  loadLettaEnvFile();
  const baseRaw = process.env.LETTA_BASE_URL?.trim() || "http://127.0.0.1:8283";
  const base = baseRaw.replace(/\/$/, "");
  const apiKey = process.env.LETTA_API_KEY?.trim() || null;

  const modelHandle =
    process.env.LETTA_NEW_AGENT_MODEL?.trim() || "openai/gpt-4o-mini";
  const embeddingHandle =
    process.env.LETTA_NEW_AGENT_EMBEDDING?.trim() ||
    "openai/text-embedding-3-small";
  const contextWindow = Number.parseInt(
    process.env.LETTA_NEW_AGENT_CONTEXT_WINDOW ?? "",
    10,
  );
  const embeddingDim = Number.parseInt(
    process.env.LETTA_NEW_AGENT_EMBEDDING_DIM ?? "",
    10,
  );

  const llmModel = normalizeLlmModel(modelHandle);
  const embeddingModel = normalizeEmbeddingModel(embeddingHandle);
  const openaiEndpoint =
    process.env.LETTA_NEW_AGENT_OPENAI_ENDPOINT?.trim() ||
    "https://api.openai.com/v1";

  const body: CreateAgentBody = {
    name: sanitizeLettaAgentName(opts.displayName, opts.profileId),
    agent_type: "memgpt_agent",
    llm_config: {
      model: llmModel,
      model_endpoint_type: "openai",
      model_endpoint: openaiEndpoint,
      context_window: Number.isFinite(contextWindow) && contextWindow > 0
        ? contextWindow
        : 128000,
    },
    embedding_config: {
      embedding_endpoint_type: "openai",
      embedding_endpoint: openaiEndpoint,
      embedding_model: embeddingModel,
      embedding_dim:
        Number.isFinite(embeddingDim) && embeddingDim > 0 ? embeddingDim : 1536,
    },
    memory: {
      memory: {
        human: {
          label: "human",
          value: `Display name: ${opts.displayName}\nProfile id: ${opts.profileId}`,
          limit: 2000,
        },
        persona: {
          label: "persona",
          value:
            "I am a helpful assistant that answers clearly and remembers context from this conversation.",
          limit: 2000,
        },
      },
    },
  };

  try {
    const res = await fetch(`${base}/v1/agents/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(
        "[lettaCreateProfileAgent]",
        res.status,
        text.slice(0, 1200),
      );
      return null;
    }

    const data = (await res.json()) as { id?: string };
    return typeof data.id === "string" ? data.id : null;
  } catch (e) {
    console.error("[lettaCreateProfileAgent]", e);
    return null;
  }
}
