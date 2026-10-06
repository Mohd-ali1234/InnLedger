import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { chargedNights, formatCurrency, formatDate, nowHHMM, todayISO } from "@/utils/format";
import { useCheckoutBooking, useOpenInvoice } from "@/hooks/useBookings";
import type { Booking } from "@/types";

interface CheckoutModalProps {
  booking: Booking | null;
  onClose: () => void;
}

/** Asks for the guest's departure date and time, then checks them out. */
export function CheckoutModal({ booking, onClose }: CheckoutModalProps) {
  const checkout = useCheckoutBooking();
  const openInvoice = useOpenInvoice();
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowHHMM());

  // Default to "right now" each time the dialog opens.
  useEffect(() => {
    if (booking) {
      const today = todayISO();
      setDate(today < booking.check_in ? booking.check_in : today);
      setTime(nowHHMM());
    }
  }, [booking]);

  if (!booking) return null;

  const nights = date ? chargedNights(booking.check_in, date) : 1;
  const rate = booking.effective_rate;
  const amount = rate * nights;
  const taxable = Math.max(0, amount - booking.discount);
  const rateTotal = booking.cgst_percent + booking.sgst_percent;
  const gst = Math.round((taxable * rateTotal) / 100 + 1e-9);
  const roomsTotal = taxable + gst;
  const total = roomsTotal + booking.services_total;

  let error = "";
  if (!date) error = "Choose the check-out date";
  else if (date < booking.check_in) error = "Check-out can't be before check-in";
  else if (date === booking.check_in && time <= booking.check_in_time) {
    error = "Check-out time must be after the check-in time";
  } else if (booking.discount > amount) error = "The discount is more than the room amount";

  const submit = () => {
    if (error) return;
    checkout.mutate(
      { id: booking.id, payload: { check_out: date, check_out_time: time } },
      {
        onSuccess: (b) => {
          onClose();
          toast.success(`${b.guest_name} checked out`, {
            action: { label: "View invoice", onClick: () => openInvoice.mutate(b.id) },
          });
        },
      }
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Check out"
      description={`${booking.guest_name} · Room ${booking.room_numbers}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={checkout.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} isLoading={checkout.isPending} disabled={Boolean(error)}>
            Check out
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Checked in {formatDate(booking.check_in, "EEE, MMM d")} at {booking.check_in_time}.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Check-out date" htmlFor="co_date" required>
            <Input
              id="co_date"
              type="date"
              min={booking.check_in}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Check-out time" htmlFor="co_time" required>
            <Input id="co_time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <div className="space-y-1.5 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm">
          <Line label={`Room (${nights} ${nights === 1 ? "night" : "nights"} × ${formatCurrency(rate)})`} value={amount} />
          {booking.discount > 0 && <Line label="Discount" value={-booking.discount} />}
          <Line label="Before tax" value={taxable} />
          <Line label={`GST (${rateTotal}%)`} value={gst} />
          {booking.services_amount > 0 && (
            <Line label="Services (incl. GST)" value={booking.services_total} />
          )}
          <div className="flex justify-between border-t border-blue-100 pt-1.5 font-semibold text-foreground">
            <span>Total with tax</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span className="tabular-nums">{formatCurrency(value)}</span>
    </div>
  );
}
