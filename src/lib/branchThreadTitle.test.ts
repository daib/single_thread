import { describe, expect, it } from "vitest";
import {
  branchTitleFromSourceInList,
  branchTitleFromSourceToRootPath,
} from "@/lib/branchThreadTitle";
import type { Conversation, Message } from "@/types";

function conv(
  id: string,
  title: string,
  opts: { branchOfId?: string; messages?: Message[] } = {},
): Conversation {
  return {
    id,
    profileId: "p1",
    title,
    preview: "",
    updatedAt: new Date().toISOString(),
    messages: opts.messages ?? [],
    ...(opts.branchOfId ? { branchOfId: opts.branchOfId } : {}),
  };
}

describe("branchTitleFromSourceToRootPath", () => {
  it("uses New chat for empty path", () => {
    expect(branchTitleFromSourceToRootPath([])).toBe("New chat");
  });

  it("uses sole node title", () => {
    expect(branchTitleFromSourceToRootPath([{ title: "Root only" }])).toBe("Root only");
  });

  it("uses source title when path is source → root (length 2)", () => {
    expect(
      branchTitleFromSourceToRootPath([{ title: "Child" }, { title: "Root" }]),
    ).toBe("Child");
  });

  it("uses first branch below root when path has three hops", () => {
    expect(
      branchTitleFromSourceToRootPath([
        { title: "Leaf" },
        { title: "First branch" },
        { title: "Root" },
      ]),
    ).toBe("First branch");
  });

  it("truncates long titles to 52 chars with ellipsis", () => {
    const long = "a".repeat(60);
    expect(branchTitleFromSourceToRootPath([{ title: long }])).toBe(`${"a".repeat(52)}…`);
  });

  it("treats blank title as New chat", () => {
    expect(branchTitleFromSourceToRootPath([{ title: "   " }])).toBe("New chat");
  });
});

describe("branchTitleFromSourceInList", () => {
  it("resolves direct child of root: title is child", () => {
    const root = conv("r", "My root");
    const child = conv("c", "Branch A", { branchOfId: "r" });
    expect(branchTitleFromSourceInList(child, [root, child])).toBe("Branch A");
  });

  it("resolves nested branch: title is first hop below root", () => {
    const root = conv("r", "Root title");
    const mid = conv("m", "First split", { branchOfId: "r" });
    const leaf = conv("l", "Deep leaf", { branchOfId: "m" });
    expect(branchTitleFromSourceInList(leaf, [root, mid, leaf])).toBe("First split");
  });

  it("stops at missing parent and still picks title from partial path", () => {
    const orphan = conv("o", "Orphan branch", { branchOfId: "missing" });
    expect(branchTitleFromSourceInList(orphan, [orphan])).toBe("Orphan branch");
  });

  it("breaks on cycle instead of hanging", () => {
    const a = conv("a", "Title A", { branchOfId: "b" });
    const b = conv("b", "Title B", { branchOfId: "a" });
    const title = branchTitleFromSourceInList(a, [a, b]);
    expect(title).toBe("Title A");
  });

  it("breaks on self-referential branchOfId", () => {
    const self = conv("s", "Self", { branchOfId: "s" });
    expect(branchTitleFromSourceInList(self, [self])).toBe("Self");
  });
});
