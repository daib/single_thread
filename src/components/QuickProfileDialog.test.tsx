import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuickProfileDialog } from "@/components/QuickProfileDialog";

describe("QuickProfileDialog", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders nothing when closed", () => {
    render(
      <QuickProfileDialog open={false} onClose={vi.fn()} accounts={[]} onSuccess={vi.fn()} />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("with no accounts, shows guidance and disables Create", () => {
    render(<QuickProfileDialog open onClose={vi.fn()} accounts={[]} onSuccess={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/create an account under account first/i);
    expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();
  });

  it("with one account, shows account note and can create profile", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        id: "p-new",
        displayName: "Persona",
        handle: "persona",
      }),
    });
    render(
      <QuickProfileDialog
        open
        onClose={onClose}
        accounts={[{ id: "acc1", displayName: "Acme", handle: "acme" }]}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("@acme")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^display name$/i), "Persona");
    await user.type(screen.getByLabelText(/^handle$/i), "persona");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/acc1/profiles",
      expect.objectContaining({ method: "POST" }),
    );
    expect(onSuccess).toHaveBeenCalledWith({
      id: "p-new",
      displayName: "Persona",
      handle: "persona",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("with multiple accounts, POSTs selected account id", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        id: "p2",
        displayName: "B",
        handle: "b",
      }),
    });
    render(
      <QuickProfileDialog
        open
        onClose={vi.fn()}
        accounts={[
          { id: "a1", displayName: "First", handle: "first" },
          { id: "a2", displayName: "Second", handle: "second" },
        ]}
        onSuccess={vi.fn()}
      />,
    );
    await user.selectOptions(screen.getByLabelText(/^account$/i), "a2");
    await user.type(screen.getByLabelText(/^display name$/i), "B");
    await user.type(screen.getByLabelText(/^handle$/i), "b");
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/a2/profiles",
      expect.anything(),
    );
  });

  it("shows API error when response not ok", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ error: "Handle in use" }),
    });
    render(
      <QuickProfileDialog
        open
        onClose={vi.fn()}
        accounts={[{ id: "acc", displayName: "A", handle: "a" }]}
        onSuccess={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText(/^display name$/i), "X");
    await user.type(screen.getByLabelText(/^handle$/i), "x");
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Handle in use");
  });

  it("Escape closes when not pending", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <QuickProfileDialog
        open
        onClose={onClose}
        accounts={[{ id: "acc", displayName: "A", handle: "a" }]}
        onSuccess={vi.fn()}
      />,
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("backdrop click calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <QuickProfileDialog
        open
        onClose={onClose}
        accounts={[{ id: "acc", displayName: "A", handle: "a" }]}
        onSuccess={vi.fn()}
      />,
    );
    const backdrop = container.querySelector(".quick-profile-dialog-backdrop");
    await user.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
