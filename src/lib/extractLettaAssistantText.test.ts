import { describe, expect, it } from "vitest";
import { coerceToMessagesArray, extractLettaAssistantText } from "@/lib/extractLettaAssistantText";

describe("coerceToMessagesArray", () => {
  it("returns empty for non-objects", () => {
    expect(coerceToMessagesArray(null)).toEqual([]);
    expect(coerceToMessagesArray(undefined)).toEqual([]);
    expect(coerceToMessagesArray(42)).toEqual([]);
  });

  it("returns array as-is", () => {
    expect(coerceToMessagesArray([1, 2])).toEqual([1, 2]);
  });

  it("unwraps messages property", () => {
    expect(coerceToMessagesArray({ messages: [{ a: 1 }] })).toEqual([{ a: 1 }]);
  });

  it("unwraps items property", () => {
    expect(coerceToMessagesArray({ items: [{ b: 2 }] })).toEqual([{ b: 2 }]);
  });
});

describe("extractLettaAssistantText", () => {
  it("returns null for empty payload", () => {
    expect(extractLettaAssistantText({ messages: [] })).toBeNull();
    expect(extractLettaAssistantText(null)).toBeNull();
  });

  it("reads assistant role with string content", () => {
    const text = extractLettaAssistantText({
      messages: [{ role: "assistant", content: "Visible reply" }],
    });
    expect(text).toBe("Visible reply");
  });

  it("reads top-level text on assistant-like message", () => {
    expect(
      extractLettaAssistantText({
        messages: [{ role: "assistant", text: "From text field" }],
      }),
    ).toBe("From text field");
  });

  it("uses internal_monologue as last resort", () => {
    expect(
      extractLettaAssistantText({
        messages: [
          {
            message_type: "internal_monologue",
            internal_monologue: "Thinking out loud",
          },
        ],
      }),
    ).toBe("Thinking out loud");
  });

  it("prefers send_message tool text over later noise", () => {
    const payload = {
      messages: [
        {
          message_type: "assistant_message",
          tool_calls: [
            {
              function: { name: "send_message", arguments: JSON.stringify({ message: "User sees this" }) },
            },
          ],
        },
        { role: "assistant", content: "ignored if earlier tool wins" },
      ],
    };
    const text = extractLettaAssistantText(payload);
    expect(text).toBe("User sees this");
  });
});
