import { describe, expect, it } from "vitest";
import { LettaHttpError } from "@/lib/lettaConversationApi";

describe("LettaHttpError", () => {
  it("sets name, message, and status", () => {
    const err = new LettaHttpError(502, "bad gateway");
    expect(err.name).toBe("LettaHttpError");
    expect(err.message).toBe("bad gateway");
    expect(err.status).toBe(502);
    expect(err).toBeInstanceOf(Error);
  });
});
