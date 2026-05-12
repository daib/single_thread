import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { messageMarkdownSpy } = vi.hoisted(() => ({
  messageMarkdownSpy: vi.fn(({ body }: { body: string }) => (
    <div className="message-md" data-testid="mock-message-md">
      {body}
    </div>
  )),
}));

vi.mock("@/components/MessageMarkdown", () => ({
  MessageMarkdown: (props: { body: string }) => messageMarkdownSpy(props),
}));

vi.mock("@/formatTime", () => ({
  formatClock: () => "3:00 PM",
}));

vi.mock("@/lib/copyTextToClipboard", () => ({
  copyTextToClipboard: vi.fn().mockResolvedValue(true),
}));

import { ChatPanel } from "@/components/ChatPanel";
import type { Conversation } from "@/types";

describe("ChatPanel composer isolation", () => {
  beforeEach(() => {
    messageMarkdownSpy.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("does not re-render MessageMarkdown for existing rows when typing in the composer", async () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      id: `m-${i}`,
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      body: `Line ${i}`,
      sentAt: "2026-01-01T10:00:00.000Z",
    }));

    const conv: Conversation = {
      id: "c1",
      profileId: "p1",
      title: "Big thread",
      preview: "pv",
      updatedAt: "2026-01-01T00:00:00.000Z",
      messages,
    };

    render(<ChatPanel conversation={conv} onSend={vi.fn()} onBranch={vi.fn()} />);

    const initialMarkdownMounts = messageMarkdownSpy.mock.calls.length;
    expect(initialMarkdownMounts).toBe(20);

    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Message text" }), "typing here");

    expect(messageMarkdownSpy.mock.calls.length).toBe(initialMarkdownMounts);
  });

  it("clears composer when switching conversation (key on ChatComposer)", async () => {
    const convA: Conversation = {
      id: "c-a",
      profileId: "p1",
      title: "A",
      preview: "p",
      updatedAt: "2026-01-01T00:00:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          body: "only",
          sentAt: "2026-01-01T10:00:00.000Z",
        },
      ],
    };
    const convB: Conversation = {
      ...convA,
      id: "c-b",
      title: "B",
    };

    const { rerender } = render(
      <ChatPanel conversation={convA} onSend={vi.fn()} onBranch={vi.fn()} />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Message text" }), "draft text");
    expect(screen.getByRole("textbox", { name: "Message text" })).toHaveValue("draft text");

    rerender(<ChatPanel conversation={convB} onSend={vi.fn()} onBranch={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Message text" })).toHaveValue("");
  });
});
