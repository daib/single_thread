import { describe, expect, it } from "vitest";
import { titleFromFirstUserMessage } from "@/lib/titleFromFirstUserMessage";

describe("titleFromFirstUserMessage", () => {
  it("collapses whitespace and trims", () => {
    expect(titleFromFirstUserMessage("  hello \n  world  ")).toBe("hello world");
  });

  it("returns untitled for empty after trim", () => {
    expect(titleFromFirstUserMessage("   \n")).toBe("(untitled)");
  });

  it("truncates with ellipsis when over max", () => {
    const long = "a".repeat(250);
    expect(titleFromFirstUserMessage(long, 10)).toBe("aaaaaaaaa…");
    expect(titleFromFirstUserMessage(long, 10).length).toBe(10);
  });
});
