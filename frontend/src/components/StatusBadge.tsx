import { Badge } from "@/components/ui/Badge";
import type { BookingStatus, RoomStatus } from "@/types";

const ROOM_STATUS: Record<RoomStatus, { label: string; variant: "success" | "info" | "warning" }> = {
  available: { label: "Available", variant: "success" },
  occupied: { label: "Occupied", variant: "info" },
  maintenance: { label: "Maintenance", variant: "warning" },
};

const BOOKING_STATUS: Record<
  BookingStatus,
  { label: string; variant: "info" | "success" | "neutral" | "danger" }
> = {
  confirmed: { label: "Confirmed", variant: "info" },
  checked_in: { label: "Checked In", variant: "success" },
  checked_out: { label: "Checked Out", variant: "neutral" },
  cancelled: { label: "Cancelled", variant: "danger" },
};

export function RoomStatusBadge({ status }: { status: RoomStatus }) {
  const { label, variant } = ROOM_STATUS[status];
  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  );
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const { label, variant } = BOOKING_STATUS[status];
  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  );
}
