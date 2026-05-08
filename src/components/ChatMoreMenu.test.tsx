import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatMoreMenu } from "@/components/ChatMoreMenu";

describe("ChatMoreMenu", () => {
  describe("sidebar / header menu", () => {
    it("opens dropdown and runs Branch", async () => {
      const onBranch = vi.fn();
      const user = userEvent.setup();
      render(
        <ChatMoreMenu
          conversationLabel="My thread"
          variant="sidebar"
          onRename={() => {}}
          onDelete={() => {}}
          onBranch={onBranch}
        />,
      );
      await user.click(
        screen.getByRole("button", {
          name: (n) => n.includes("More actions") && n.includes("My thread"),
        }),
      );
      expect(screen.getByRole("menu")).toBeInTheDocument();
      await user.click(screen.getByRole("menuitem", { name: "Branch" }));
      expect(onBranch).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("runs Rename and Delete from menu", async () => {
      const onRename = vi.fn();
      const onDelete = vi.fn();
      const user = userEvent.setup();
      render(
        <ChatMoreMenu
          conversationLabel="T"
          variant="header"
          onRename={onRename}
          onDelete={onDelete}
          onBranch={() => {}}
        />,
      );
      await user.click(
        screen.getByRole("button", { name: (n) => n.includes("More actions") && n.includes("T") }),
      );
      await user.click(screen.getByRole("menuitem", { name: "Rename" }));
      await user.click(
        screen.getByRole("button", { name: (n) => n.includes("More actions") && n.includes("T") }),
      );
      await user.click(screen.getByRole("menuitem", { name: "Delete" }));
      expect(onRename).toHaveBeenCalled();
      expect(onDelete).toHaveBeenCalled();
    });

    it("closes menu on Escape", async () => {
      const user = userEvent.setup();
      render(
        <ChatMoreMenu
          conversationLabel="X"
          variant="sidebar"
          onRename={() => {}}
          onDelete={() => {}}
          onBranch={() => {}}
        />,
      );
      await user.click(
        screen.getByRole("button", { name: (n) => n.includes("More actions") && n.includes("X") }),
      );
      expect(screen.getByRole("menu")).toBeInTheDocument();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("runs Download from menu when onDownload is provided", async () => {
      const onDownload = vi.fn();
      const user = userEvent.setup();
      render(
        <ChatMoreMenu
          conversationLabel="Export me"
          variant="sidebar"
          onRename={() => {}}
          onDelete={() => {}}
          onBranch={() => {}}
          onDownload={onDownload}
        />,
      );
      await user.click(
        screen.getByRole("button", {
          name: (n) => n.includes("More actions") && n.includes("Export me"),
        }),
      );
      await user.click(screen.getByRole("menuitem", { name: "Download" }));
      expect(onDownload).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("does not offer Download when onDownload is omitted", async () => {
      const user = userEvent.setup();
      render(
        <ChatMoreMenu
          conversationLabel="No export"
          variant="sidebar"
          onRename={() => {}}
          onDelete={() => {}}
          onBranch={() => {}}
        />,
      );
      await user.click(
        screen.getByRole("button", {
          name: (n) => n.includes("More actions") && n.includes("No export"),
        }),
      );
      expect(screen.queryByRole("menuitem", { name: "Download" })).toBeNull();
    });

    it("lists Rename, Branch, Download, Delete in order when all handlers exist", async () => {
      const user = userEvent.setup();
      render(
        <ChatMoreMenu
          conversationLabel="Full"
          variant="sidebar"
          onRename={() => {}}
          onDelete={() => {}}
          onBranch={() => {}}
          onDownload={() => {}}
        />,
      );
      await user.click(
        screen.getByRole("button", { name: (n) => n.includes("More actions") && n.includes("Full") }),
      );
      const items = screen.getAllByRole("menuitem");
      expect(items.map((el) => el.textContent)).toEqual(["Rename", "Branch", "Download", "Delete"]);
    });
  });

  describe("message variant", () => {
    it("calls onBranch immediately without opening a menu", async () => {
      const onBranch = vi.fn();
      const user = userEvent.setup();
      render(
        <ChatMoreMenu
          conversationLabel="Your message"
          variant="message"
          onBranch={onBranch}
        />,
      );
      await user.click(
        screen.getByRole("button", { name: /Branch from this message \(Your message\)/ }),
      );
      expect(onBranch).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });
});
