import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RenameConversationDialog } from "@/components/RenameConversationDialog";

describe("RenameConversationDialog", () => {
  it("renders nothing when closed", () => {
    render(
      <RenameConversationDialog
        open={false}
        initialTitle="Old"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows initial title in input when open", () => {
    render(
      <RenameConversationDialog open initialTitle="My thread" onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByRole("textbox", { name: /title/i })).toHaveValue("My thread");
  });

  it("syncs value when reopened with new initialTitle", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <RenameConversationDialog open initialTitle="First" onClose={onClose} onConfirm={onConfirm} />,
    );
    expect(screen.getByRole("textbox", { name: /title/i })).toHaveValue("First");
    rerender(
      <RenameConversationDialog open={false} initialTitle="First" onClose={onClose} onConfirm={onConfirm} />,
    );
    rerender(
      <RenameConversationDialog open initialTitle="Second" onClose={onClose} onConfirm={onConfirm} />,
    );
    expect(screen.getByRole("textbox", { name: /title/i })).toHaveValue("Second");
  });

  it("Save is disabled for empty or whitespace-only title", () => {
    render(
      <RenameConversationDialog open initialTitle="   " onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled();
  });

  it("submits trimmed title to onConfirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <RenameConversationDialog open initialTitle="Old" onClose={vi.fn()} onConfirm={onConfirm} />,
    );
    const input = screen.getByRole("textbox", { name: /title/i });
    await user.clear(input);
    await user.type(input, "  New name  ");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onConfirm).toHaveBeenCalledWith("New name");
  });

  it("truncates title to 200 characters", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const long = "a".repeat(201);
    render(
      <RenameConversationDialog open initialTitle="" onClose={vi.fn()} onConfirm={onConfirm} />,
    );
    const input = screen.getByRole("textbox", { name: /title/i });
    await user.type(input, long);
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onConfirm).toHaveBeenCalledWith("a".repeat(200));
  });

  it("Cancel and Escape call onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { unmount } = render(
      <RenameConversationDialog open initialTitle="T" onClose={onClose} onConfirm={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    onClose.mockClear();
    render(
      <RenameConversationDialog open initialTitle="T" onClose={onClose} onConfirm={vi.fn()} />,
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("backdrop click calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <RenameConversationDialog open initialTitle="T" onClose={onClose} onConfirm={vi.fn()} />,
    );
    await user.click(container.querySelector(".rename-dialog-backdrop")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
