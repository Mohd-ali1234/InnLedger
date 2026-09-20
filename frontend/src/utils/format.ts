import { format, parseISO, differenceInCalendarDays } from "date-fns";

export function formatDate(value: string | Date, pattern = "MMM d, yyyy"): string {
  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, pattern);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Number of nights between two ISO dates (check_out - check_in). */
export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(0, differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn)));
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
