import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PortalTooltipButton } from "@/components/PortalTooltipButton";

describe("PortalTooltipButton", () => {
  it("invokes onClick", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <PortalTooltipButton tooltip="Tip text" ariaLabel="Do action" onClick={onClick}>
        <span>icon</span>
      </PortalTooltipButton>,
    );
    await user.click(screen.getByRole("button", { name: "Do action" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders floating tooltip on hover after mount", async () => {
    const user = userEvent.setup();
    render(
      <PortalTooltipButton tooltip="Hover tip" ariaLabel="Target" onClick={() => {}}>
        x
      </PortalTooltipButton>,
    );
    await user.hover(screen.getByRole("button", { name: "Target" }));
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent("Hover tip");
    });
  });

  it("hides tooltip when hideTooltip is true", async () => {
    const user = userEvent.setup();
    render(
      <PortalTooltipButton
        tooltip="Hidden"
        ariaLabel="Menu"
        hideTooltip
        onClick={() => {}}
      >
        ⋮
      </PortalTooltipButton>,
    );
    await user.hover(screen.getByRole("button", { name: "Menu" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
