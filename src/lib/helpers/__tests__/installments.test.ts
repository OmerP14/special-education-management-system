import { describe, expect, it } from "vitest";
import {
  computeInstallmentDueDate,
  getInstallmentDisplayStatus,
  splitAmountIntoInstallments,
} from "@/lib/helpers/installments";
import type { InstallmentRecord } from "@/types";

describe("splitAmountIntoInstallments", () => {
  it("splits evenly and puts the remainder in the last installment", () => {
    expect(splitAmountIntoInstallments(1000, 3)).toEqual([333, 333, 334]);
  });

  it("always sums back to the total", () => {
    const parts = splitAmountIntoInstallments(12_345, 7);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(12_345);
  });

  it("returns nothing for a non-positive count", () => {
    expect(splitAmountIntoInstallments(1000, 0)).toEqual([]);
  });
});

describe("computeInstallmentDueDate", () => {
  it("adds months for a monthly plan", () => {
    expect(computeInstallmentDueDate("2026-01-15", 0, "monthly", 30)).toBe("2026-01-15");
    expect(computeInstallmentDueDate("2026-01-15", 2, "monthly", 30)).toBe("2026-03-15");
  });

  it("clamps to the last day of a shorter month instead of spilling over", () => {
    expect(computeInstallmentDueDate("2026-01-31", 1, "monthly", 30)).toBe("2026-02-28");
    expect(computeInstallmentDueDate("2026-01-31", 2, "monthly", 30)).toBe("2026-03-31");
    expect(computeInstallmentDueDate("2026-01-31", 3, "monthly", 30)).toBe("2026-04-30");
    expect(computeInstallmentDueDate("2028-01-30", 1, "monthly", 30)).toBe("2028-02-29");
  });

  it("crosses year boundaries", () => {
    expect(computeInstallmentDueDate("2026-11-30", 3, "monthly", 30)).toBe("2027-02-28");
  });

  it("adds weeks and custom day intervals", () => {
    expect(computeInstallmentDueDate("2026-01-01", 2, "weekly", 30)).toBe("2026-01-15");
    expect(computeInstallmentDueDate("2026-01-01", 2, "custom", 10)).toBe("2026-01-21");
  });
});

describe("getInstallmentDisplayStatus", () => {
  const record = (status: InstallmentRecord["status"], dueDate: string): InstallmentRecord => ({
    id: "i1",
    installmentNumber: 1,
    dueDate,
    amount: 100,
    status,
  });

  it("keeps paid and cancelled as stored", () => {
    const later = new Date("2030-01-01");
    expect(getInstallmentDisplayStatus(record("paid", "2026-01-01"), later)).toBe("paid");
    expect(getInstallmentDisplayStatus(record("cancelled", "2026-01-01"), later)).toBe("cancelled");
  });

  it("is still pending on the due date itself", () => {
    expect(getInstallmentDisplayStatus(record("pending", "2026-05-10"), new Date(2026, 4, 10, 18))).toBe("pending");
  });

  it("becomes overdue after the due date when there is no tolerance", () => {
    expect(getInstallmentDisplayStatus(record("pending", "2026-05-10"), new Date(2026, 4, 12), 0)).toBe("overdue");
  });

  it("waits for the late-payment tolerance before marking overdue", () => {
    const inst = record("pending", "2026-05-10");
    expect(getInstallmentDisplayStatus(inst, new Date(2026, 4, 14), 5)).toBe("pending");
    expect(getInstallmentDisplayStatus(inst, new Date(2026, 4, 16), 5)).toBe("overdue");
  });
});
