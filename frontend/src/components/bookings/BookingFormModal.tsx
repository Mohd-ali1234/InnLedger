import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Info } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { BOOKING_STATUSES, PAYMENT_METHODS } from "@/utils/constants";
import { formatCurrency, nightsBetween } from "@/utils/format";
import { useRooms } from "@/hooks/useRooms";
import { useSettings } from "@/hooks/useSettings";
import { useCreateBooking, useOpenDocument, useUpdateBooking } from "@/hooks/useBookings";
import { bookingsService } from "@/services/bookings.service";
import { getApiErrorMessage } from "@/services/api";
import { DocumentsPicker } from "@/components/bookings/DocumentsPicker";
import type { Booking, BookingInput, BookingStatus, PaymentMethod, Room } from "@/types";

interface BookingFormModalProps {
  open: boolean;
  booking: Booking | null;
  onClose: () => void;
  /** Called with the new booking after a successful create (not on edit). */
  onCreated?: (booking: Booking) => void;
}

type FormState = {
  guest_name: string;
  phone: string;
  email: string;
  address: string;
  company_name: string;
  guest_gst_number: string;
  room_id: string;
  check_in: string;
  check_out: string;
  guest_count: string;
  status: BookingStatus;
  check_in_time: string;
  check_out_time: string;
  payment_method: PaymentMethod;
  rate: string; // per night, before tax
  rate_with_tax: string; // per night, incl. tax (linked to `rate`)
  discount: string; // total discount in rupees
};

const round2 = (n: number) => (Math.round(n * 100) / 100).toString();

const today = () => new Date().toISOString().slice(0, 10);

function emptyState(): FormState {
  return {
    guest_name: "",
    phone: "",
    email: "",
    address: "",
    company_name: "",
    guest_gst_number: "",
    room_id: "",
    check_in: today(),
    check_out: "",
    guest_count: "1",
    status: "confirmed",
    check_in_time: "12:00",
    check_out_time: "11:00",
    payment_method: "Cash",
    rate: "",
    rate_with_tax: "",
    discount: "0",
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function BookingFormModal({ open, booking, onClose, onCreated }: BookingFormModalProps) {
  const isEdit = Boolean(booking);
  const { data: rooms } = useRooms();
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const openDocument = useOpenDocument();
  const qc = useQueryClient();
  const { data: hotel } = useSettings();

  // Tax rates: the booking's own snapshot when editing, otherwise the current hotel settings.
  const cgst = booking?.cgst_percent ?? hotel?.cgst_percent ?? 2.5;
  const sgst = booking?.sgst_percent ?? hotel?.sgst_percent ?? 2.5;
  const taxFactor = 1 + (cgst + sgst) / 100;

  const [form, setForm] = useState<FormState>(emptyState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [removedDocIds, setRemovedDocIds] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setNewFiles([]);
    setRemovedDocIds([]);
    setForm(
      booking
        ? {
            guest_name: booking.guest_name,
            phone: booking.phone,
            email: booking.email,
            address: booking.address ?? "",
            company_name: booking.company_name ?? "",
            guest_gst_number: booking.guest_gst_number ?? "",
            room_id: String(booking.room_id),
            check_in: booking.check_in,
            check_out: booking.check_out,
            guest_count: String(booking.guest_count),
            status: booking.status,
            check_in_time: booking.check_in_time,
            check_out_time: booking.check_out_time,
            payment_method: booking.payment_method,
            rate: round2(booking.effective_rate),
            rate_with_tax: round2(
              booking.effective_rate * (1 + (booking.cgst_percent + booking.sgst_percent) / 100)
            ),
            discount: String(booking.discount),
          }
        : emptyState()
    );
  }, [open, booking]);

  // Only bookable rooms (not under maintenance). When editing, keep the current room selectable.
  const selectableRooms: Room[] = useMemo(() => {
    if (!rooms) return [];
    return rooms.filter(
      (r) => r.status !== "maintenance" || (booking && r.id === booking.room_id)
    );
  }, [rooms, booking]);

  const selectedRoom = useMemo(
    () => selectableRooms.find((r) => String(r.id) === form.room_id),
    [selectableRooms, form.room_id]
  );

  const nights =
    form.check_in && form.check_out ? nightsBetween(form.check_in, form.check_out) : 0;

  const rateNum = Number(form.rate) || 0;
  const discountNum = Number(form.discount) || 0;
  const amount = rateNum * nights;
  const taxable = Math.max(0, amount - discountNum);
  // Matches the backend: GST is rounded to the whole rupee, then split into CGST / SGST.
  const gst = Math.round((taxable * (cgst + sgst)) / 100 + 1e-9);
  const cgstAmt = cgst + sgst ? (gst * cgst) / (cgst + sgst) : 0;
  const sgstAmt = gst - cgstAmt;
  const total = taxable + gst;

  const set = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Editing either price keeps the other in sync.
  const setRate = (value: string) =>
    setForm((prev) => ({
      ...prev,
      rate: value,
      rate_with_tax:
        value.trim() === "" || isNaN(Number(value)) ? "" : round2(Number(value) * taxFactor),
    }));
  const setRateWithTax = (value: string) =>
    setForm((prev) => ({
      ...prev,
      rate_with_tax: value,
      rate: value.trim() === "" || isNaN(Number(value)) ? "" : round2(Number(value) / taxFactor),
    }));

  // Picking a room loads its listed (pre-tax) price as the starting rate.
  const handleRoomChange = (roomId: string) => {
    const room = selectableRooms.find((r) => String(r.id) === roomId);
    setForm((prev) => ({
      ...prev,
      room_id: roomId,
      rate: room ? round2(room.price) : prev.rate,
      rate_with_tax: room ? round2(room.price * taxFactor) : prev.rate_with_tax,
    }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.guest_name.trim()) next.guest_name = "Guest name is required";
    if (!form.phone.trim()) next.phone = "Phone number is required";
    if (!EMAIL_RE.test(form.email)) next.email = "Enter a valid email address";
    if (form.guest_gst_number.trim() && !/^[0-9A-Za-z]{15}$/.test(form.guest_gst_number.trim())) {
      next.guest_gst_number = "GST number is 15 characters";
    }
    if (form.address.trim().length > 255) next.address = "Keep the address under 255 characters";
    if (!form.room_id) next.room_id = "Select a room";
    if (!form.check_in) next.check_in = "Check-in date is required";
    if (!form.check_out) next.check_out = "Check-out date is required";
    if (form.check_in && form.check_out && form.check_out <= form.check_in) {
      next.check_out = "Check-out must be after check-in";
    }
    if (form.rate.trim() === "" || !(rateNum >= 0)) next.rate = "Enter the room rate";
    if (!(discountNum >= 0)) next.discount = "Cannot be negative";
    else if (discountNum > amount) next.discount = "Cannot exceed the room amount";
    const guests = Number(form.guest_count);
    if (!(guests > 0)) next.guest_count = "At least 1 guest";
    else if (selectedRoom && guests > selectedRoom.capacity) {
      next.guest_count = `Max ${selectedRoom.capacity} for this room`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: BookingInput = {
      guest_name: form.guest_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim() || null,
      company_name: form.company_name.trim() || null,
      guest_gst_number: form.guest_gst_number.trim().toUpperCase() || null,
      room_id: Number(form.room_id),
      check_in: form.check_in,
      check_out: form.check_out,
      guest_count: Number(form.guest_count),
      status: form.status,
      check_in_time: form.check_in_time || "12:00",
      check_out_time: form.check_out_time || "11:00",
      payment_method: form.payment_method,
      rate: rateNum,
      discount: discountNum,
    };

    // Documents are optional and go up after the booking itself is saved.
    const syncDocuments = async (id: number) => {
      if (!newFiles.length && !removedDocIds.length) return;
      setUploading(true);
      try {
        await Promise.all(removedDocIds.map((d) => bookingsService.deleteDocument(id, d)));
        if (newFiles.length) await bookingsService.uploadDocuments(id, newFiles);
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Booking saved, but the documents could not be updated"));
      } finally {
        setUploading(false);
        qc.invalidateQueries({ queryKey: ["bookings"] });
      }
    };

    if (isEdit && booking) {
      updateBooking.mutate(
        { id: booking.id, payload },
        {
          onSuccess: async () => {
            await syncDocuments(booking.id);
            onClose();
          },
        }
      );
    } else {
      createBooking.mutate(payload, {
        onSuccess: async (created) => {
          await syncDocuments(created.id);
          onClose();
          onCreated?.(created);
        },
      });
    }
  };

  const isSubmitting = createBooking.isPending || updateBooking.isPending || uploading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Booking" : "New Booking"}
      description={
        isEdit ? "Update this reservation's details." : "Create a reservation for a guest."
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="booking-form" isLoading={isSubmitting}>
            {isEdit ? "Save changes" : "Create booking"}
          </Button>
        </>
      }
    >
      <form id="booking-form" onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Guest information */}
        <section className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Guest information
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Full Name" htmlFor="guest_name" required error={errors.guest_name}>
                <Input
                  id="guest_name"
                  value={form.guest_name}
                  onChange={(e) => set("guest_name", e.target.value)}
                  placeholder="e.g. Amelia Turner"
                  aria-invalid={Boolean(errors.guest_name)}
                />
              </Field>
            </div>
            <Field label="Phone Number" htmlFor="phone" required error={errors.phone}>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+1 202 555 0100"
                aria-invalid={Boolean(errors.phone)}
              />
            </Field>
            <Field label="Email" htmlFor="email" required error={errors.email}>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="guest@example.com"
                aria-invalid={Boolean(errors.email)}
              />
            </Field>
            <Field label="Company Name" htmlFor="company_name" error={errors.company_name}>
              <Input
                id="company_name"
                value={form.company_name}
                onChange={(e) => set("company_name", e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <Field label="Guest GST No." htmlFor="guest_gst_number" error={errors.guest_gst_number}>
              <Input
                id="guest_gst_number"
                value={form.guest_gst_number}
                onChange={(e) => set("guest_gst_number", e.target.value)}
                placeholder="e.g. 24ABCDE1234F1Z5"
                maxLength={15}
                aria-invalid={Boolean(errors.guest_gst_number)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address" htmlFor="address" error={errors.address}>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="14 Rosewood Avenue, Springfield, IL 62704"
                  aria-invalid={Boolean(errors.address)}
                />
              </Field>
            </div>
          </div>
          <DocumentsPicker
            existing={(booking?.documents ?? []).filter((d) => !removedDocIds.includes(d.id))}
            pending={newFiles}
            onAdd={(files) => setNewFiles((prev) => [...prev, ...files])}
            onRemoveExisting={(id) => setRemovedDocIds((prev) => [...prev, id])}
            onRemovePending={(i) => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))}
            onView={booking ? (doc) => openDocument.mutate({ bookingId: booking.id, doc }) : undefined}
          />
        </section>

        {/* Booking information */}
        <section className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Booking information
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Room" htmlFor="room_id" required error={errors.room_id}>
                <Select
                  id="room_id"
                  value={form.room_id}
                  onChange={(e) => handleRoomChange(e.target.value)}
                  aria-invalid={Boolean(errors.room_id)}
                >
                  <option value="" disabled>
                    Select an available room
                  </option>
                  {selectableRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.room_number} · {r.room_name} · {r.room_type} ·{" "}
                      {formatCurrency(r.price)}/night · up to {r.capacity}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Check-in Date" htmlFor="check_in" required error={errors.check_in}>
              <Input
                id="check_in"
                type="date"
                value={form.check_in}
                onChange={(e) => set("check_in", e.target.value)}
                aria-invalid={Boolean(errors.check_in)}
              />
            </Field>
            <Field label="Check-in Time" htmlFor="check_in_time">
              <Input
                id="check_in_time"
                type="time"
                value={form.check_in_time}
                onChange={(e) => set("check_in_time", e.target.value)}
              />
            </Field>
            <Field label="Check-out Date" htmlFor="check_out" required error={errors.check_out}>
              <Input
                id="check_out"
                type="date"
                min={form.check_in || undefined}
                value={form.check_out}
                onChange={(e) => set("check_out", e.target.value)}
                aria-invalid={Boolean(errors.check_out)}
              />
            </Field>

            <Field label="Check-out Time" htmlFor="check_out_time">
              <Input
                id="check_out_time"
                type="time"
                value={form.check_out_time}
                onChange={(e) => set("check_out_time", e.target.value)}
              />
            </Field>

            <Field
              label="Number of Guests"
              htmlFor="guest_count"
              required
              error={errors.guest_count}
              hint={selectedRoom ? `Room capacity: ${selectedRoom.capacity}` : undefined}
            >
              <Input
                id="guest_count"
                type="number"
                min={1}
                max={selectedRoom?.capacity}
                value={form.guest_count}
                onChange={(e) => set("guest_count", e.target.value)}
                aria-invalid={Boolean(errors.guest_count)}
              />
            </Field>
            <Field label="Status" htmlFor="booking_status" required>
              <Select
                id="booking_status"
                value={form.status}
                onChange={(e) => set("status", e.target.value as BookingStatus)}
              >
                {BOOKING_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

        </section>

        {/* Pricing & payment */}
        <section className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pricing &amp; payment
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Rate / night (before tax) ₹" htmlFor="rate" required error={errors.rate}>
              <Input
                id="rate"
                type="number"
                min={0}
                step="0.01"
                value={form.rate}
                onChange={(e) => setRate(e.target.value)}
                aria-invalid={Boolean(errors.rate)}
              />
            </Field>
            <Field
              label="Rate / night (with tax) ₹"
              htmlFor="rate_with_tax"
              hint={`Includes ${cgst + sgst}% GST (CGST ${cgst}% + SGST ${sgst}%)`}
            >
              <Input
                id="rate_with_tax"
                type="number"
                min={0}
                step="0.01"
                value={form.rate_with_tax}
                onChange={(e) => setRateWithTax(e.target.value)}
              />
            </Field>
            <Field label="Discount (₹, total)" htmlFor="discount" error={errors.discount}>
              <Input
                id="discount"
                type="number"
                min={0}
                step="0.01"
                value={form.discount}
                onChange={(e) => set("discount", e.target.value)}
                aria-invalid={Boolean(errors.discount)}
              />
            </Field>
            <Field label="Payment method" htmlFor="payment_method">
              <Select
                id="payment_method"
                value={form.payment_method}
                onChange={(e) => set("payment_method", e.target.value as PaymentMethod)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {nights > 0 && rateNum > 0 && (
            <div className="space-y-1.5 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <CalendarDays className="size-4 text-primary" />
                {nights} {nights === 1 ? "night" : "nights"} × {formatCurrency(rateNum)}
              </div>
              <SummaryRow label="Room amount" value={amount} />
              {discountNum > 0 && <SummaryRow label="Discount" value={-discountNum} />}
              <SummaryRow label="Before tax" value={taxable} />
              <SummaryRow label={`CGST (${cgst}%)`} value={cgstAmt} />
              <SummaryRow label={`SGST (${sgst}%)`} value={sgstAmt} />
              <div className="flex justify-between border-t border-blue-100 pt-1.5 font-semibold text-foreground">
                <span>Total with tax</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          )}
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Rooms under maintenance are hidden. Overlapping dates on the same room are rejected
            automatically.
          </p>
        </section>
      </form>
    </Modal>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
