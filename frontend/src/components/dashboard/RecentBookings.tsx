import { Link } from "react-router-dom";
import { ArrowRight, CalendarX2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { BookingStatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, initials } from "@/utils/format";
import type { Booking } from "@/types";

export function RecentBookings({ bookings }: { bookings: Booking[] }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recent Bookings</CardTitle>
        <Link
          to="/bookings"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View all
          <ArrowRight className="size-4" />
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        {bookings.length === 0 ? (
          <EmptyState icon={CalendarX2} title="No bookings yet" description="New bookings will show up here." />
        ) : (
          <ul className="divide-y divide-border">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {initials(b.guest_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{b.guest_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Room {b.room.room_number} · {formatDate(b.check_in)} → {formatDate(b.check_out)}
                  </p>
                </div>
                <BookingStatusBadge status={b.status} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
