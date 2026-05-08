import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteProfileDialog } from "@/components/DeleteProfileDialog";

describe("DeleteProfileDialog", () => {
  it("renders nothing when closed", () => {
    render(
      <DeleteProfileDialog
        open={false}
        displayName="Ada"
        handle="ada"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows profile details when open", () => {
    render(
      <DeleteProfileDialog
        open
        displayName="Ada Lovelace"
        handle="ada"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("@ada")).toBeInTheDocument();
  });

  it("Cancel calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <DeleteProfileDialog open displayName="A" handle="a" onClose={onClose} onConfirm={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <DeleteProfileDialog open displayName="B" handle="b" onClose={onClose} onConfirm={vi.fn()} />,
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("backdrop click calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <DeleteProfileDialog open displayName="A" handle="a" onClose={onClose} onConfirm={vi.fn()} />,
    );
    const backdrop = container.querySelector(".delete-profile-dialog-backdrop");
    expect(backdrop).toBeTruthy();
    await user.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Delete profile awaits onConfirm then closes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <DeleteProfileDialog open displayName="A" handle="a" onClose={onClose} onConfirm={onConfirm} />,
    );
    await user.click(screen.getByRole("button", { name: /^delete profile$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
