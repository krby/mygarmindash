import { describe, it, expect } from "vitest";
import { clampDays } from "../src/queries";

describe("clampDays", () => {
  it("uses the fallback when missing or non-numeric", () => {
    expect(clampDays(null)).toBe(30);
    expect(clampDays("abc")).toBe(30);
    expect(clampDays(null, 42)).toBe(42);
  });

  it("uses the fallback for non-positive values", () => {
    expect(clampDays("0")).toBe(30);
    expect(clampDays("-5")).toBe(30);
  });

  it("parses a valid value", () => {
    expect(clampDays("7")).toBe(7);
  });

  it("clamps to the max", () => {
    expect(clampDays("99999")).toBe(365);
    expect(clampDays("99999", 30, 90)).toBe(90);
  });
});
