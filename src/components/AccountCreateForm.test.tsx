import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signOut } from "next-auth/react";
import { AccountCreateForm } from "@/components/AccountCreateForm";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

describe("AccountCreateForm", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    refresh.mockClear();
    vi.mocked(signOut).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("when hasAccount, shows account copy and Sign out calls next-auth", async () => {
    const user = userEvent.setup();
    render(<AccountCreateForm hasAccount />);
    expect(screen.getByRole("heading", { name: /your account/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/" });
  });

  it("when no account, submits POST /api/account and refreshes on success", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    render(<AccountCreateForm hasAccount={false} />);
    await user.type(screen.getByLabelText(/account name/i), "My workspace");
    await user.type(screen.getByLabelText(/account handle/i), "my_workspace");
    await user.click(screen.getByRole("button", { name: /^create account$/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body).toEqual({ displayName: "My workspace", handle: "my_workspace" });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/account name/i)).toHaveValue("");
    expect(screen.getByLabelText(/account handle/i)).toHaveValue("");
  });

  it("sanitizes handle input to allowed characters", async () => {
    const user = userEvent.setup();
    render(<AccountCreateForm hasAccount={false} />);
    const handle = screen.getByLabelText(/account handle/i);
    await user.type(handle, "AbC!9");
    expect(handle).toHaveValue("abc9");
  });

  it("shows API error from response body", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Handle already taken" }),
    });
    render(<AccountCreateForm hasAccount={false} />);
    await user.type(screen.getByLabelText(/account name/i), "X");
    await user.type(screen.getByLabelText(/account handle/i), "taken");
    await user.click(screen.getByRole("button", { name: /^create account$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Handle already taken");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows network error when fetch throws", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    render(<AccountCreateForm hasAccount={false} />);
    await user.type(screen.getByLabelText(/account name/i), "X");
    await user.type(screen.getByLabelText(/account handle/i), "yy");
    await user.click(screen.getByRole("button", { name: /^create account$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/network error/i);
  });
});
