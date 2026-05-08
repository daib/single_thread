import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import type { Conversation } from "@/types";

vi.mock("@/formatTime", () => ({
  formatRelativeTime: () => "9m ago",
}));

function conv(
  id: string,
  title: string,
  opts: { branchOfId?: string; messages?: Conversation["messages"] } = {},
): Conversation {
  return {
    id,
    profileId: "p1",
    title,
    preview: "preview text",
    updatedAt: "2026-05-08T12:00:00.000Z",
    messages: opts.messages ?? [{ id: "m1", role: "user", body: "x", sentAt: "2026-05-08T12:00:00.000Z" }],
    ...opts,
  };
}

const noop = () => {};

describe("ConversationSidebar", () => {
  it("lists conversations and New chat", () => {
    render(
      <ConversationSidebar
        conversations={[conv("a", "Alpha"), conv("b", "Beta")]}
        selectedId={null}
        onSelect={noop}
        onDelete={noop}
        onNewChat={noop}
        onBranch={noop}
        onRename={noop}
      />,
    );
    expect(screen.getByRole("button", { name: "New chat" })).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("calls onSelect when a thread is opened", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <ConversationSidebar
        conversations={[conv("x", "Pick me")]}
        selectedId={null}
        onSelect={onSelect}
        onDelete={noop}
        onNewChat={noop}
        onBranch={noop}
        onRename={noop}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Open conversation: Pick me" }));
    expect(onSelect).toHaveBeenCalledWith("x");
  });

  it("calls onNewChat", async () => {
    const onNewChat = vi.fn();
    const user = userEvent.setup();
    render(
      <ConversationSidebar
        conversations={[]}
        selectedId={null}
        onSelect={noop}
        onDelete={noop}
        onNewChat={onNewChat}
        onBranch={noop}
        onRename={noop}
      />,
    );
    await user.click(screen.getByRole("button", { name: "New chat" }));
    expect(onNewChat).toHaveBeenCalled();
  });

  it("nests branched thread with branch marker", () => {
    const root = conv("r", "Root");
    const child = conv("c", "Child", { branchOfId: "r" });
    render(
      <ConversationSidebar
        conversations={[root, child]}
        selectedId={null}
        onSelect={noop}
        onDelete={noop}
        onNewChat={noop}
        onBranch={noop}
        onRename={noop}
      />,
    );
    expect(screen.getByTitle("Branched thread")).toBeInTheDocument();
  });
});
