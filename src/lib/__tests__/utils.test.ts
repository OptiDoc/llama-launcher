import { describe, it, expect } from "vitest";
import { hashStr, formatDuration, fmtTime } from "@/lib/utils";

describe("lib/utils", () => {
  describe("hashStr", () => {
    it("returns consistent 32-bit integer for same input", () => {
      const h1 = hashStr("hello world");
      const h2 = hashStr("hello world");
      expect(h1).toBe(h2);
      expect(h1).toBeGreaterThanOrEqual(0);
    });

    it("returns different values for different inputs", () => {
      expect(hashStr("a")).not.toBe(hashStr("b"));
    });

    it("handles empty string", () => {
      // FNV-1a returns initial hash for empty string
      expect(hashStr("")).toBe(2128831035);
    });

    it("handles unicode characters", () => {
      const h = hashStr("🚀🌟🎉");
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBe(hashStr("🚀🌟🎉"));
    });
  });

  describe("formatDuration", () => {
    it("formats seconds correctly", () => {
      expect(formatDuration(30)).toBe("30s");
      expect(formatDuration(59)).toBe("59s");
    });

    it("formats minutes correctly", () => {
      expect(formatDuration(60)).toBe("1m 0s");
      expect(formatDuration(90)).toBe("1m 30s");
      expect(formatDuration(3599)).toBe("59m 59s");
    });

    it("formats hours correctly", () => {
      expect(formatDuration(3600)).toBe("1h 0m");
      expect(formatDuration(7200)).toBe("2h 0m");
      expect(formatDuration(3661)).toBe("1h 1m");
    });

    it("handles edge cases", () => {
      expect(formatDuration(0)).toBe("0s");
      expect(formatDuration(-1)).toBe("");
      expect(formatDuration(Infinity)).toBe("");
      expect(formatDuration(NaN)).toBe("");
    });
  });

  describe("fmtTime", () => {
    it("formats Date object to HH:MM:SS", () => {
      const d = new Date("2024-01-15T14:30:45.123Z");
      expect(fmtTime(d)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it("formats timestamp number to HH:MM:SS", () => {
      const ts = new Date("2024-01-15T14:30:45.123Z").getTime();
      expect(fmtTime(ts)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });
  });
});
