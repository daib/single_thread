import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "@/lib/copyTextToClipboard";

describe("copyTextToClipboard", () => {
  const originalClipboard = navigator.clipboard;

  function stubExecCommand(returnValue: boolean) {
    const fn = vi.fn().mockReturnValue(returnValue);
    Object.defineProperty(document, "execCommand", {
      value: fn,
      configurable: true,
      writable: true,
    });
    return fn;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
    Reflect.deleteProperty(document, "execCommand");
  });

  it("returns true when Clipboard API writeText succeeds", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    await expect(copyTextToClipboard("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to execCommand when writeText throws", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      },
      configurable: true,
      writable: true,
    });

    const execCommand = stubExecCommand(true);

    await expect(copyTextToClipboard("fallback text")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("returns false when Clipboard fails and execCommand returns false", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      },
      configurable: true,
      writable: true,
    });

    stubExecCommand(false);

    await expect(copyTextToClipboard("x")).resolves.toBe(false);
  });

  it("uses fallback when clipboard API is missing", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    stubExecCommand(true);

    await expect(copyTextToClipboard("no api")).resolves.toBe(true);
  });

  it("returns false when DOM fallback throws", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const orig = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "textarea") {
        throw new Error("blocked");
      }
      return orig(tag);
    });

    await expect(copyTextToClipboard("bad")).resolves.toBe(false);
  });
});
