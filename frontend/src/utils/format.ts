import { format, parseISO, differenceInCalendarDays } from "date-fns";

export function formatDate(value: string | Date, pattern = "MMM d, yyyy"): string {
  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, pattern);
}

/** Today's date as yyyy-MM-dd in the user's local time zone (toISOString would use UTC). */
export const todayISO = () => format(new Date(), "yyyy-MM-dd");

/** Current local time as HH:mm. */
export const nowHHMM = () => format(new Date(), "HH:mm");

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Rupees with paise (for tax splits like 29.50). */
export function formatCurrencyExact(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Number of nights between two ISO dates (check_out - check_in). */
export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(0, differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn)));
}

/** Nights billed: a same-day stay still counts as one. */
export function chargedNights(checkIn: string, checkOut: string): number {
  return Math.max(1, nightsBetween(checkIn, checkOut));
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
