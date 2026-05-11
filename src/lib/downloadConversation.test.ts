import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildConversationExport,
  downloadConversationJson,
  EXPORT_FORMAT_VERSION,
  safeDownloadFilename,
} from "@/lib/downloadConversation";
import type { Conversation } from "@/types";

function sampleConv(over: Partial<Conversation> = {}): Conversation {
  return {
    id: "conv-uuid-1",
    profileId: "p1",
    title: "My / Chat: Title!",
    preview: "hi",
    updatedAt: "2026-01-01T00:00:00.000Z",
    messages: [
      { id: "m1", role: "user", body: "Hello", sentAt: "2026-01-01T12:00:00.000Z" },
    ],
    ...over,
  };
}

describe("downloadConversation", () => {
  it("buildConversationExport includes profile and conversation", () => {
    const c = sampleConv();
    const out = buildConversationExport(c, {
      id: "p1",
      displayName: "Ada",
      handle: "ada",
    });
    expect(out.format).toBe(EXPORT_FORMAT_VERSION);
    expect(out.profile).toEqual({
      id: "p1",
      displayName: "Ada",
      handle: "ada",
    });
    expect(out.conversation).toEqual(c);
    expect(out.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("buildConversationExport allows null profile", () => {
    const out = buildConversationExport(sampleConv(), null);
    expect(out.profile).toBeNull();
  });

  it("safeDownloadFilename slugifies title and shortens id", () => {
    expect(safeDownloadFilename("My / Chat: Title!", "conv-uuid-1")).toBe(
      "My-Chat-Title-convuuid.json",
    );
  });

  it("safeDownloadFilename uses conversation fallback when title is empty", () => {
    expect(safeDownloadFilename("   ", "abc")).toBe("conversation-abc.json");
  });

  it("safeDownloadFilename uses thread when id has no alphanumerics", () => {
    expect(safeDownloadFilename("Hi", "---")).toBe("Hi-thread.json");
  });
});

describe("downloadConversationJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a JSON blob, sets filename, clicks anchor, and revokes URL", async () => {
    const c = sampleConv();
    let blobArg: Blob | null = null;
    const createObjectURL = vi.fn((b: Blob) => {
      blobArg = b;
      return "blob:test-url";
    });
    const revokeObjectURL = vi.fn();

    const urlHolder = URL as unknown as {
      createObjectURL?: typeof createObjectURL;
      revokeObjectURL?: typeof revokeObjectURL;
    };
    const prevCreate = urlHolder.createObjectURL;
    const prevRevoke = urlHolder.revokeObjectURL;
    urlHolder.createObjectURL = createObjectURL;
    urlHolder.revokeObjectURL = revokeObjectURL;

    const blobCtor = vi.spyOn(globalThis, "Blob").mockImplementation((parts: BlobPart[]) => {
      const json = String(parts[0] ?? "");
      return {
        type: "application/json;charset=utf-8",
        text: () => Promise.resolve(json),
      } as unknown as Blob;
    });

    const click = vi.fn();
    const mockAnchor = {
      href: "",
      download: "",
      rel: "",
      click,
    } as unknown as HTMLAnchorElement;

    try {
      vi.spyOn(document, "createElement").mockReturnValue(mockAnchor);

      downloadConversationJson(c, {
        id: "p1",
        displayName: "Ada",
        handle: "ada",
      });

      expect(click).toHaveBeenCalledTimes(1);
      expect(mockAnchor.download).toBe(safeDownloadFilename(c.title, c.id));
      expect(mockAnchor.rel).toBe("noopener");
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
      expect(blobArg).not.toBeNull();
      const text = await blobArg!.text();
      const parsed = JSON.parse(text) as ReturnType<typeof buildConversationExport>;
      expect(parsed.format).toBe(EXPORT_FORMAT_VERSION);
      expect(parsed.conversation).toEqual(c);
      expect(parsed.profile).toEqual({
        id: "p1",
        displayName: "Ada",
        handle: "ada",
      });
    } finally {
      blobCtor.mockRestore();
      if (prevCreate !== undefined) urlHolder.createObjectURL = prevCreate;
      else delete urlHolder.createObjectURL;
      if (prevRevoke !== undefined) urlHolder.revokeObjectURL = prevRevoke;
      else delete urlHolder.revokeObjectURL;
    }
  });
});
