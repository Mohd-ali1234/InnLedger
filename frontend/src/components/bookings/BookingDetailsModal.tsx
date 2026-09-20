import {
  BedDouble,
  CalendarDays,
  Mail,
  MapPin,
  Moon,
  Phone,
  FileText,
  Users,
  Wallet,
} from "lucide-react";
import type { ComponentType } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { BookingStatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate, initials, nightsBetween } from "@/utils/format";
import { useOpenDocument } from "@/hooks/useBookings";
import type { Booking } from "@/types";

interface BookingDetailsModalProps {
  open: boolean;
  booking: Booking | null;
  onClose: () => void;
  onEdit: (booking: Booking) => void;
}

export function BookingDetailsModal({ open, booking, onClose, onEdit }: BookingDetailsModalProps) {
  const openDocument = useOpenDocument();
  if (!booking) return null;

  const nights = nightsBetween(booking.check_in, booking.check_out);
  const total = booking.total;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Booking Details"
      description={`Reservation #${booking.id}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => {
              onClose();
              onEdit(booking);
            }}
          >
            Edit booking
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Guest header */}
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
            {initials(booking.guest_name)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold text-foreground">{booking.guest_name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5" />
                {booking.email}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5" />
                {booking.phone}
              </span>
            </div>
          </div>
          <BookingStatusBadge status={booking.status} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DetailRow icon={BedDouble} label="Room">
            Room {booking.room.room_number} · {booking.room.room_name}
          </DetailRow>
          <DetailRow icon={Users} label="Guests">
            {booking.guest_count} of {booking.room.capacity}
          </DetailRow>
          <DetailRow icon={CalendarDays} label="Check-in">
            {formatDate(booking.check_in, "EEE, MMM d, yyyy")}
          </DetailRow>
          <DetailRow icon={CalendarDays} label="Check-out">
            {formatDate(booking.check_out, "EEE, MMM d, yyyy")}
          </DetailRow>
          <DetailRow icon={Moon} label="Nights">
            {nights} {nights === 1 ? "night" : "nights"}
          </DetailRow>
          <DetailRow icon={Wallet} label="Total (incl. tax)">
            <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
          </DetailRow>
          {booking.documents.length > 0 && (
            <div className="sm:col-span-2">
              <DetailRow icon={FileText} label="ID documents">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {booking.documents.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className="cursor-pointer text-primary underline-offset-2 hover:underline"
                      onClick={() => openDocument.mutate({ bookingId: booking.id, doc: d })}
                    >
                      {d.filename}
                    </button>
                  ))}
                </div>
              </DetailRow>
            </div>
          )}
          {booking.address && (
            <div className="sm:col-span-2">
              <DetailRow icon={MapPin} label="Address">
                {booking.address}
              </DetailRow>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-slate-50/60 px-3.5 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-muted-foreground shadow-soft ring-1 ring-border">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm text-foreground">{children}</p>
      </div>
    </div>
  );
}
