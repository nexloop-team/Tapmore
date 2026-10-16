import { describe, expect, it } from "vitest";
import { isBirthdayToday } from "./birthday";

describe("isBirthdayToday", () => {
  it("is true on the day itself only", () => {
    expect(isBirthdayToday(10, 8, { year: 2026, month: 10, day: 8 })).toBe(true);
    expect(isBirthdayToday(10, 8, { year: 2026, month: 10, day: 7 })).toBe(false);
    expect(isBirthdayToday(10, 8, { year: 2026, month: 10, day: 9 })).toBe(false);
  });

  it("celebrates 29 February on 1 March outside leap years", () => {
    expect(isBirthdayToday(2, 29, { year: 2027, month: 3, day: 1 })).toBe(true);
    expect(isBirthdayToday(2, 29, { year: 2028, month: 2, day: 29 })).toBe(true);
    expect(isBirthdayToday(2, 29, { year: 2028, month: 3, day: 1 })).toBe(false);
  });

  it("is false without a birthday", () => {
    expect(isBirthdayToday(null, null, { year: 2026, month: 10, day: 8 })).toBe(false);
  });
});
