import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatPanel } from "@/components/ChatPanel";
import type { Conversation } from "@/types";

vi.mock("@/formatTime", () => ({
  formatClock: () => "3:00 PM",
}));

vi.mock("@/lib/copyTextToClipboard", () => ({
  copyTextToClipboard: vi.fn().mockResolvedValue(true),
}));

import { copyTextToClipboard } from "@/lib/copyTextToClipboard";

function sampleConversation(over: Partial<Conversation> = {}): Conversation {
  return {
    id: "c1",
    profileId: "p1",
    title: "Test chat",
    preview: "pv",
    updatedAt: "2026-01-01T00:00:00.000Z",
    messages: [
      {
        id: "m1",
        role: "user",
        body: "Hello there",
        sentAt: "2026-01-01T10:00:00.000Z",
      },
    ],
    ...over,
  };
}

const noop = () => {};

describe("ChatPanel", () => {
  beforeEach(() => {
    vi.mocked(copyTextToClipboard).mockClear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("shows empty state without conversation", () => {
    render(
      <ChatPanel
        conversation={undefined}
        onSend={noop}
        onDelete={noop}
        onBranch={noop}
        onRename={noop}
      />,
    );
    expect(screen.getByText("Select a conversation to read messages.")).toBeInTheDocument();
  });

  it("renders heading and message body", () => {
    render(
      <ChatPanel
        conversation={sampleConversation()}
        onSend={noop}
        onDelete={noop}
        onBranch={noop}
        onRename={noop}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Test chat");
    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });

  it("submits composer and calls onSend", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(
      <ChatPanel
        conversation={sampleConversation()}
        onSend={onSend}
        onDelete={noop}
        onBranch={noop}
        onRename={noop}
      />,
    );
    await user.type(screen.getByRole("textbox", { name: "Message text" }), "outgoing");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledWith("c1", "outgoing");
  });

  it("copies visible message via copy control", async () => {
    const user = userEvent.setup();
    render(
      <ChatPanel
        conversation={sampleConversation()}
        onSend={noop}
        onDelete={noop}
        onBranch={noop}
        onRename={noop}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Copy message to clipboard" }));
    expect(copyTextToClipboard).toHaveBeenCalledWith("Hello there");
  });

  it("branches from user message with conversation and message ids", async () => {
    const onBranch = vi.fn();
    const user = userEvent.setup();
    render(
      <ChatPanel
        conversation={sampleConversation()}
        onSend={noop}
        onDelete={noop}
        onBranch={onBranch}
        onRename={noop}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /Branch from this message \(Your message\)/ }),
    );
    expect(onBranch).toHaveBeenCalledWith("c1", "m1");
  });

  it("shows Branched label when conversation has branchOfId", () => {
    render(
      <ChatPanel
        conversation={sampleConversation({ branchOfId: "parent-id" })}
        onSend={noop}
        onDelete={noop}
        onBranch={noop}
        onRename={noop}
      />,
    );
    expect(screen.getByText("Branched")).toBeInTheDocument();
  });

  it("shows active profile in subtitle", () => {
    render(
      <ChatPanel
        conversation={sampleConversation()}
        activeProfile={{ id: "p1", displayName: "Ada", handle: "ada" }}
        onSend={noop}
        onDelete={noop}
        onBranch={noop}
        onRename={noop}
      />,
    );
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("@ada")).toBeInTheDocument();
  });
});
