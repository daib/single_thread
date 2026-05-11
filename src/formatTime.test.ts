import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatClock, formatRelativeTime } from "@/formatTime";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T14:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns just now under one minute", () => {
    expect(formatRelativeTime("2026-05-08T13:59:30.000Z")).toBe("just now");
  });

  it("returns minutes ago", () => {
    expect(formatRelativeTime("2026-05-08T13:30:00.000Z")).toBe("30m ago");
  });

  it("returns hours ago", () => {
    expect(formatRelativeTime("2026-05-08T10:00:00.000Z")).toBe("4h ago");
  });

  it("returns days ago", () => {
    expect(formatRelativeTime("2026-05-05T14:00:00.000Z")).toBe("3d ago");
  });

  it("never returns negative-looking offsets for future dates", () => {
    expect(formatRelativeTime("2026-05-09T14:00:00.000Z")).toBe("just now");
  });
});

describe("formatClock", () => {
  it("returns a non-empty localized time string", () => {
    const s = formatClock("2026-05-08T15:30:00.000Z");
    expect(s.length).toBeGreaterThan(0);
    expect(/\d/.test(s)).toBe(true);
  });
});
