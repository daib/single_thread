import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageMarkdown } from "@/components/MessageMarkdown";

describe("MessageMarkdown", () => {
  it("wraps output in message-md and renders plain text", () => {
    const { container } = render(<MessageMarkdown body="Plain hello" />);
    expect(container.querySelector(".message-md")).toBeTruthy();
    expect(screen.getByText("Plain hello")).toBeInTheDocument();
  });

  it("renders headings, bold, and italic", () => {
    render(<MessageMarkdown body={"## Section\n\nLine with **bold** and *italic*."} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Section");
    expect(document.querySelector(".message-md strong")?.textContent).toBe("bold");
    expect(document.querySelector(".message-md em")?.textContent).toBe("italic");
  });

  it("renders GFM strikethrough", () => {
    render(<MessageMarkdown body="~~removed~~ kept" />);
    expect(document.querySelector(".message-md del")?.textContent).toBe("removed");
    expect(screen.getByText(/kept/)).toBeInTheDocument();
  });

  it("renders fenced code block", () => {
    render(<MessageMarkdown body={"```js\nconst x = 1\n```"} />);
    const pre = document.querySelector(".message-md pre");
    expect(pre?.textContent).toContain("const x = 1");
  });

  it("renders bullet list", () => {
    render(<MessageMarkdown body={"- first\n- second"} />);
    const items = document.querySelectorAll(".message-md ul li");
    expect(items.length).toBe(2);
    expect(items[0]?.textContent).toContain("first");
    expect(items[1]?.textContent).toContain("second");
  });

  it("renders GFM table", () => {
    const body = "| h1 | h2 |\n| -- | -- |\n| v1 | v2 |";
    render(<MessageMarkdown body={body} />);
    const table = document.querySelector(".message-md table");
    expect(table).toBeTruthy();
    expect(document.querySelectorAll(".message-md th").length).toBe(2);
    expect(table?.textContent).toContain("v1");
    expect(table?.textContent).toContain("v2");
  });

  it("strips script tags from inline HTML (sanitized)", () => {
    render(<MessageMarkdown body={'Hello <script>alert(1)</script> world'} />);
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText(/Hello/)).toBeInTheDocument();
    expect(screen.getByText(/world/)).toBeInTheDocument();
  });

  it("renders autolink from GFM", () => {
    render(<MessageMarkdown body="See https://example.org/path" />);
    const a = document.querySelector('.message-md a[href="https://example.org/path"]');
    expect(a).toBeTruthy();
  });
});
