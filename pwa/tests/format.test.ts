import { describe, it, expect } from "vitest";
import {
  formatDuration,
  formatDistance,
  formatPace,
  formatElevation,
  formatStrengthWeight,
  formatBodyWeight,
  formatTemperature,
  formatExerciseName,
  formatDateLong,
  formatDateLongMaybeYear,
  formatDateShort,
  formatTime,
} from "../src/lib/format";

describe("formatDuration", () => {
  it("shows hours and minutes past an hour", () => {
    expect(formatDuration(3661)).toBe("1h 01m");
  });
  it("shows minutes and seconds under an hour", () => {
    expect(formatDuration(150)).toBe("2m 30s");
  });
  it("returns — for non-positive / invalid", () => {
    expect(formatDuration(0)).toBe("—");
    expect(formatDuration(-5)).toBe("—");
    expect(formatDuration("nope")).toBe("—");
  });
});

describe("formatDistance", () => {
  it("converts meters to miles with 2 decimals", () => {
    expect(formatDistance(1609.344)).toBe("1.00 mi");
    expect(formatDistance(5000)).toBe("3.11 mi");
  });
  it("returns — for invalid", () => {
    expect(formatDistance("x")).toBe("—");
  });
});

describe("formatPace", () => {
  it("formats seconds/mile as m:ss/mi", () => {
    expect(formatPace(510)).toBe("8:30/mi");
    expect(formatPace(605)).toBe("10:05/mi");
  });
  it("returns — for non-positive", () => {
    expect(formatPace(0)).toBe("—");
    expect(formatPace(null)).toBe("—");
  });
});

describe("formatElevation", () => {
  it("converts meters to whole feet", () => {
    expect(formatElevation(100)).toBe("328 ft");
  });
  it("returns — for null", () => {
    expect(formatElevation(null)).toBe("—");
  });
});

describe("formatStrengthWeight", () => {
  it("converts grams to whole pounds", () => {
    expect(formatStrengthWeight(45359)).toBe("100 lb");
  });
  it("snaps conversion noise to the nearest half pound", () => {
    // ~45.1 lb of grams collapses to a clean 45.
    expect(formatStrengthWeight(20460)).toBe("45 lb");
  });
  it("preserves real half-pound weights", () => {
    // 7.5 lb in grams stays 7.5.
    expect(formatStrengthWeight(3375)).toBe("7.5 lb");
  });
  it("treats 0 / null as bodyweight", () => {
    expect(formatStrengthWeight(0)).toBe("bodyweight");
    expect(formatStrengthWeight(null)).toBe("bodyweight");
  });
});

describe("formatBodyWeight", () => {
  it("converts grams to pounds", () => {
    expect(formatBodyWeight(80000)).toBe("176.4 lb");
  });
  it("returns — for 0 / null", () => {
    expect(formatBodyWeight(0)).toBe("—");
    expect(formatBodyWeight(null)).toBe("—");
  });
});

describe("formatTemperature", () => {
  it("converts celsius to fahrenheit", () => {
    expect(formatTemperature(0)).toBe("32°F");
    expect(formatTemperature(100)).toBe("212°F");
  });
  it("returns — for null", () => {
    expect(formatTemperature(null)).toBe("—");
  });
});

describe("formatExerciseName", () => {
  it("title-cases an UPPER_SNAKE name", () => {
    expect(formatExerciseName("BARBELL_BENCH_PRESS")).toBe("Barbell Bench Press");
  });
  it("returns Exercise for null", () => {
    expect(formatExerciseName(null)).toBe("Exercise");
  });
});

describe("date formatters (locale/TZ-independent assertions)", () => {
  // Exact output is locale/timezone dependent; assert the safe-fallback branch
  // and that valid input does not fall back.
  it("returns — for invalid / non-string input", () => {
    expect(formatDateLong(null)).toBe("—");
    expect(formatDateLong("not a date")).toBe("—");
    expect(formatDateShort(undefined)).toBe("—");
    expect(formatTime("")).toBe("—");
  });

  it("formats a valid date string to something non-empty", () => {
    expect(formatDateLong("2024-01-02")).not.toBe("—");
    expect(formatTime("2024-01-02T10:30:00")).not.toBe("—");
  });

  it("formatDateLongMaybeYear shows the year only outside the current year", () => {
    const thisYear = new Date().getFullYear();
    // Mid-year date avoids any timezone roll-over across the year boundary.
    expect(formatDateLongMaybeYear(`${thisYear}-07-15`)).not.toContain(
      String(thisYear),
    );
    expect(formatDateLongMaybeYear(`${thisYear - 1}-07-15`)).toContain(
      String(thisYear - 1),
    );
    expect(formatDateLongMaybeYear(null)).toBe("—");
  });
});
