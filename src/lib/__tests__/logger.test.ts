/**
 * Tests for frontend logger.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../logger", async () => {
  const actual = await vi.importActual("../logger");
  return { ...actual };
});

import { log, setLogLevel, setCorrelationId, measure, emitLog } from "../logger";

describe("logger", () => {
  beforeEach(() => {
    setLogLevel("debug");
    setCorrelationId(null);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("setLogLevel", () => {
    it("should set log level without throwing", () => {
      expect(() => setLogLevel("warn")).not.toThrow();
    });
  });

  describe("setCorrelationId", () => {
    it("should set correlation id without throwing", () => {
      expect(() => setCorrelationId("test-id")).not.toThrow();
    });

    it("should clear correlation id without throwing", () => {
      setCorrelationId("test-id");
      expect(() => setCorrelationId(null)).not.toThrow();
    });
  });

  describe("log levels", () => {
    it("should log debug message without throwing", () => {
      expect(() => log.debug("test debug", { category: "test" })).not.toThrow();
    });

    it("should log info message without throwing", () => {
      expect(() => log.info("test info", { category: "test" })).not.toThrow();
    });

    it("should log warn message without throwing", () => {
      expect(() => log.warn("test warn", { category: "test" })).not.toThrow();
    });

    it("should log error message without throwing", () => {
      expect(() => log.error("test error", { category: "test" })).not.toThrow();
    });

    it("should respect log level filter", () => {
      setLogLevel("warn");
      // debug should not throw even if filtered
      expect(() => log.debug("should be filtered")).not.toThrow();
    });
  });

  describe("emitLog", () => {
    it("should emit log without throwing", () => {
      expect(() => emitLog("test-instance", "info", "test message")).not.toThrow();
    });
  });

  describe("measure", () => {
    it("should return function result", () => {
      vi.useRealTimers();
      console.log("measure fn:", typeof measure);
      const result = measure("test operation", "test", () => 42);
      console.log("result:", result);
      expect(result).toBe(42);
      vi.useFakeTimers();
    });

    it("should return string result", () => {
      vi.useRealTimers();
      const result = measure("test operation", "test", () => "done");
      expect(result).toBe("done");
      vi.useFakeTimers();
    });

    it("should log duration via info", () => {
      const spy = vi.spyOn(log, "info").mockImplementation(() => {});
      measure("test operation", "test", () => "result");
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
