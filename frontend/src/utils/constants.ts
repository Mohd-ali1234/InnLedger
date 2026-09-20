import type { BookingStatus, RoomStatus } from "@/types";

export const ROOM_TYPES = ["Single", "Double", "Twin", "Deluxe", "Suite", "Family", "Studio"];

export const ROOM_STATUSES: { value: RoomStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "occupied", label: "Occupied" },
  { value: "maintenance", label: "Maintenance" },
];

export const BOOKING_STATUSES: { value: BookingStatus; label: string }[] = [
  { value: "confirmed", label: "Confirmed" },
  { value: "checked_in", label: "Checked In" },
  { value: "checked_out", label: "Checked Out" },
  { value: "cancelled", label: "Cancelled" },
];

/** External Pathik dashboard, offered after a booking is created. */
export const PATHIK_DASHBOARD_URL = "https://pathik.guru/dashboard";

/** Pathik's guest-registration form, which "Save on Pathik" pre-fills. */
export const PATHIK_ADD_GUEST_URL = "https://pathik.guru/dashboard/add";

export const PAYMENT_METHODS = ["Cash", "Online", "UPI", "Card", "Bank Transfer"] as const;
