import { describe, expect, it } from "vitest";
import { computeWeeklyPlanStatus, generateSessionDates, nextDayString } from "@/lib/helpers/weekly-plans";

describe("generateSessionDates", () => {
  it("creates one session per matching weekday in the range", () => {
    // 2026-03-02 is a Monday; Mondays + Wednesdays over two weeks.
    const dates = generateSessionDates("2026-03-02", "2026-03-15", [
      { dayOfWeek: 1, time: "10:00" },
      { dayOfWeek: 3, time: "14:30" },
    ]);
    expect(dates).toHaveLength(4);
    const local = dates.map((d) => {
      const x = new Date(d);
      return `${x.getDate()} ${x.getHours()}:${String(x.getMinutes()).padStart(2, "0")}`;
    });
    expect(local).toEqual(["2 10:00", "4 14:30", "9 10:00", "11 14:30"]);
  });

  it("includes the end date", () => {
    expect(generateSessionDates("2026-03-02", "2026-03-09", [{ dayOfWeek: 1, time: "09:00" }])).toHaveLength(2);
  });

  it("returns nothing for an empty schedule or inverted range", () => {
    expect(generateSessionDates("2026-03-02", "2026-03-09", [])).toEqual([]);
    expect(generateSessionDates("2026-03-09", "2026-03-02", [{ dayOfWeek: 1, time: "09:00" }])).toEqual([]);
  });
});

describe("nextDayString", () => {
  it("rolls over month and year ends", () => {
    expect(nextDayString("2026-02-28")).toBe("2026-03-01");
    expect(nextDayString("2026-12-31")).toBe("2027-01-01");
  });
});

describe("computeWeeklyPlanStatus", () => {
  const now = new Date(2026, 5, 15);
  it("reports paused, completed and active plans", () => {
    expect(computeWeeklyPlanStatus({ isActive: false, endDate: "2026-12-31" }, now)).toBe("paused");
    expect(computeWeeklyPlanStatus({ isActive: true, endDate: "2026-06-14" }, now)).toBe("completed");
    expect(computeWeeklyPlanStatus({ isActive: true, endDate: "2026-06-15" }, now)).toBe("active");
  });
});
