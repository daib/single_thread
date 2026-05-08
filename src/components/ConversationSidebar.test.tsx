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
        onDownload={noop}
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
        onDownload={noop}
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
        onDownload={noop}
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
        onDownload={noop}
      />,
    );
    expect(screen.getByTitle("Branched thread")).toBeInTheDocument();
  });

  async function openMoreFor(title: string, user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      screen.getByRole("button", {
        name: (n) => n.includes("More actions") && n.includes(title),
      }),
    );
  }

  it("calls onDownload with that conversation", async () => {
    const onDownload = vi.fn();
    const user = userEvent.setup();
    const thread = conv("tid", "Thread A");
    render(
      <ConversationSidebar
        conversations={[thread]}
        selectedId={null}
        onSelect={noop}
        onDelete={noop}
        onNewChat={noop}
        onBranch={noop}
        onRename={noop}
        onDownload={onDownload}
      />,
    );
    await openMoreFor("Thread A", user);
    await user.click(screen.getByRole("menuitem", { name: "Download" }));
    expect(onDownload).toHaveBeenCalledWith(thread);
  });

  it("calls onRename with conversation id", async () => {
    const onRename = vi.fn();
    const user = userEvent.setup();
    render(
      <ConversationSidebar
        conversations={[conv("rid", "Rename me")]}
        selectedId={null}
        onSelect={noop}
        onDelete={noop}
        onNewChat={noop}
        onBranch={noop}
        onRename={onRename}
        onDownload={noop}
      />,
    );
    await openMoreFor("Rename me", user);
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(onRename).toHaveBeenCalledWith("rid");
  });

  it("calls onDelete with conversation id", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <ConversationSidebar
        conversations={[conv("did", "Delete me")]}
        selectedId={null}
        onSelect={noop}
        onDelete={onDelete}
        onNewChat={noop}
        onBranch={noop}
        onRename={noop}
        onDownload={noop}
      />,
    );
    await openMoreFor("Delete me", user);
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("did");
  });

  it("calls onBranch with conversation id", async () => {
    const onBranch = vi.fn();
    const user = userEvent.setup();
    render(
      <ConversationSidebar
        conversations={[conv("bid", "Branch me")]}
        selectedId={null}
        onSelect={noop}
        onDelete={noop}
        onNewChat={noop}
        onBranch={onBranch}
        onRename={noop}
        onDownload={noop}
      />,
    );
    await openMoreFor("Branch me", user);
    await user.click(screen.getByRole("menuitem", { name: "Branch" }));
    expect(onBranch).toHaveBeenCalledWith("bid");
  });

  it("hides Branch in menu when conversation has no messages", async () => {
    const user = userEvent.setup();
    render(
      <ConversationSidebar
        conversations={[conv("empty", "No msgs", { messages: [] })]}
        selectedId={null}
        onSelect={noop}
        onDelete={noop}
        onNewChat={noop}
        onBranch={noop}
        onRename={noop}
        onDownload={noop}
      />,
    );
    await openMoreFor("No msgs", user);
    expect(screen.queryByRole("menuitem", { name: "Branch" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Download" })).toBeInTheDocument();
  });
});
