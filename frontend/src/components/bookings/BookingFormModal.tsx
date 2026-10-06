import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/utils/cn";
import { PAYMENT_METHODS } from "@/utils/constants";
import { chargedNights, formatCurrency, formatCurrencyExact, nowHHMM, todayISO } from "@/utils/format";
import { useRooms } from "@/hooks/useRooms";
import { useSettings } from "@/hooks/useSettings";
import { useCreateBooking, useOpenDocument, useUpdateBooking } from "@/hooks/useBookings";
import { bookingsService } from "@/services/bookings.service";
import { getApiErrorMessage } from "@/services/api";
import { DocumentsPicker } from "@/components/bookings/DocumentsPicker";
import { RoomMultiSelect } from "@/components/bookings/RoomMultiSelect";
import { SERVICE_KEYS } from "@/types";
import type {
  Booking,
  BookingInput,
  BookingStatus,
  PaymentMethod,
  Room,
  ServiceCharges,
  ServiceKey,
} from "@/types";

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
  check_in: string;
  check_in_time: string;
  check_out: string; // edit only — normally filled by the Check out action
  check_out_time: string;
  guest_count: string;
  status: BookingStatus;
  payment_method: PaymentMethod;
  discount: string; // total discount in rupees
};

/** One selected room with its own per-night rate. */
type Line = {
  room_id: number;
  rate: string; // before tax
  rate_with_tax: string; // incl. tax (linked to `rate`)
};

type Errors = Partial<Record<keyof FormState | "room_id" | "rate" | "services", string>>;

const round2 = (n: number) => (Math.round(n * 100) / 100).toString();

const SERVICE_LABELS: Record<ServiceKey, string> = {
  food_beverages: "Food & Beverages",
  laundry: "Laundry",
  miscellaneous: "Miscellaneous",
  taxi: "Taxi",
  extra_person: "Extra Person",
  extra_bed: "Extra Bed",
};

const emptyServices = (): Record<ServiceKey, string> =>
  Object.fromEntries(SERVICE_KEYS.map((k) => [k, ""])) as Record<ServiceKey, string>;

const fromServices = (s?: ServiceCharges): Record<ServiceKey, string> =>
  Object.fromEntries(SERVICE_KEYS.map((k) => [k, s && s[k] > 0 ? round2(s[k]) : ""])) as Record<ServiceKey, string>;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emptyState(): FormState {
  return {
    guest_name: "",
    phone: "",
    email: "",
    address: "",
    company_name: "",
    guest_gst_number: "",
    check_in: todayISO(),
    check_in_time: nowHHMM(),
    check_out: "",
    check_out_time: "11:00",
    guest_count: "1",
    status: "checked_in",
    payment_method: "Cash",
    discount: "0",
  };
}

/** Compact labelled field so the whole form fits one screen. */
function Fld({
  label,
  htmlFor,
  required,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] font-medium leading-tight text-destructive">{error}</p>}
    </div>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex shrink-0 flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5 shadow-soft",
        className
      )}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

// Slightly shorter inputs on short windows so the whole form still fits.
const compact = "h-9 [@media(max-height:720px)]:h-8";

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
  const [lines, setLines] = useState<Line[]>([]);
  // Optional extra charges; the section stays collapsed until the user opens it.
  const [services, setServices] = useState<Record<ServiceKey, string>>(emptyServices);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [removedDocIds, setRemovedDocIds] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setNewFiles([]);
    setRemovedDocIds([]);
    setServicesOpen(false);
    setServices(booking ? fromServices(booking.services) : emptyServices());
    setLines(
      booking
        ? booking.rooms.map((r) => ({
            room_id: r.room_id,
            rate: round2(r.rate),
            rate_with_tax: round2(
              r.rate * (1 + (booking.cgst_percent + booking.sgst_percent) / 100)
            ),
          }))
        : []
    );
    setForm(
      booking
        ? {
            guest_name: booking.guest_name,
            phone: booking.phone,
            email: booking.email ?? "",
            address: booking.address ?? "",
            company_name: booking.company_name ?? "",
            guest_gst_number: booking.guest_gst_number ?? "",
            check_in: booking.check_in,
            check_in_time: booking.check_in_time,
            check_out: booking.check_out ?? "",
            check_out_time: booking.check_out_time,
            guest_count: String(booking.guest_count),
            status: booking.status,
            payment_method: booking.payment_method,
            discount: String(booking.discount),
          }
        : emptyState()
    );
  }, [open, booking]);

  // Full-screen: Escape closes, and the page behind must not scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Bookable rooms: not under maintenance and not currently occupied (an open stay holds the
  // room until check-out). When editing, the booking's own rooms stay selectable.
  const selectableRooms: Room[] = useMemo(() => {
    if (!rooms) return [];
    return rooms.filter(
      (r) =>
        (r.status !== "maintenance" && r.status !== "occupied") ||
        Boolean(booking?.rooms.some((br) => br.room_id === r.id))
    );
  }, [rooms, booking]);

  const totalCapacity = lines.reduce(
    (n, l) => n + (selectableRooms.find((r) => r.id === l.room_id)?.capacity ?? 0),
    0
  );
  const numberOf = (id: number) => selectableRooms.find((r) => r.id === id)?.room_number ?? "";

  // Total per-night rate across all selected rooms, before tax.
  const rateNum = lines.reduce((n, l) => n + (Number(l.rate) || 0), 0);
  const discountNum = Number(form.discount) || 0;
  const hasCheckout = Boolean(form.check_out);
  const nights = hasCheckout ? chargedNights(form.check_in, form.check_out) : 1;
  const amount = rateNum * nights;
  // Without a check-out date the discount can't be judged yet; it applies at check-out.
  const appliedDiscount = hasCheckout ? discountNum : 0;
  const taxable = Math.max(0, amount - appliedDiscount);
  // Matches the backend: GST is rounded to the whole rupee, then split into CGST / SGST.
  const gst = Math.round((taxable * (cgst + sgst)) / 100 + 1e-9);
  const cgstAmt = cgst + sgst ? (gst * cgst) / (cgst + sgst) : 0;
  const sgstAmt = gst - cgstAmt;
  const total = taxable + gst;

  // Services carry the same CGST/SGST as the room; each line is rounded to the paisa.
  const serviceAmounts = SERVICE_KEYS.map((k) => Math.max(0, Number(services[k]) || 0));
  const servicesAmount = serviceAmounts.reduce((n, a) => n + a, 0);
  const servicesTotal = serviceAmounts.reduce(
    (n, a) => n + a + Math.round(a * cgst) / 100 + Math.round(a * sgst) / 100,
    0
  );

  const set = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // Picking rooms adds a line for each, pre-filled with the room's listed (pre-tax) price.
  const handleRoomsChange = (ids: number[]) => {
    setLines((prev) =>
      ids.map((id) => {
        const existing = prev.find((l) => l.room_id === id);
        if (existing) return existing;
        const price = selectableRooms.find((r) => r.id === id)?.price ?? 0;
        return { room_id: id, rate: round2(price), rate_with_tax: round2(price * taxFactor) };
      })
    );
    setErrors((prev) => ({ ...prev, room_id: undefined, rate: undefined }));
  };

  // Editing either price on a line keeps the other in sync.
  const setLineRate = (id: number, value: string) => {
    const blank = value.trim() === "" || isNaN(Number(value));
    setLines((prev) =>
      prev.map((l) =>
        l.room_id === id
          ? { ...l, rate: value, rate_with_tax: blank ? "" : round2(Number(value) * taxFactor) }
          : l
      )
    );
    if (errors.rate) setErrors((prev) => ({ ...prev, rate: undefined }));
  };
  const setLineRateWithTax = (id: number, value: string) => {
    const blank = value.trim() === "" || isNaN(Number(value));
    setLines((prev) =>
      prev.map((l) =>
        l.room_id === id
          ? { ...l, rate_with_tax: value, rate: blank ? "" : round2(Number(value) / taxFactor) }
          : l
      )
    );
    if (errors.rate) setErrors((prev) => ({ ...prev, rate: undefined }));
  };

  const validate = (): boolean => {
    const next: Errors = {};
    if (!form.guest_name.trim()) next.guest_name = "Required";
    if (!form.phone.trim()) next.phone = "Required";
    else if (form.phone.trim().length < 3) next.phone = "Too short";
    if (lines.length === 0) next.room_id = "Select at least one room";
    if (!form.check_in) next.check_in = "Required";
    if (lines.some((l) => l.rate.trim() === "" || isNaN(Number(l.rate)) || Number(l.rate) < 0)) {
      next.rate = "Enter a rate for every room";
    }

    // Everything below is optional — only validate it when filled in.
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) next.email = "Not a valid email";
    if (form.guest_gst_number.trim() && !/^[0-9A-Za-z]{15}$/.test(form.guest_gst_number.trim())) {
      next.guest_gst_number = "Must be 15 characters";
    }
    if (form.address.trim().length > 255) next.address = "Max 255 characters";
    const guests = Number(form.guest_count);
    if (form.guest_count.trim() !== "") {
      if (!(guests > 0)) next.guest_count = "At least 1";
      else if (totalCapacity > 0 && guests > totalCapacity) {
        next.guest_count = `Max ${totalCapacity}`;
      }
    }
    if (SERVICE_KEYS.some((k) => services[k].trim() !== "" && !(Number(services[k]) >= 0))) {
      next.services = "Service amounts must be 0 or more";
      setServicesOpen(true);
    }
    if (discountNum < 0) next.discount = "Cannot be negative";
    if (hasCheckout) {
      if (form.check_out < form.check_in) next.check_out = "Before check-in";
      else if (form.check_out === form.check_in && form.check_out_time <= form.check_in_time) {
        next.check_out_time = "After check-in time";
      }
      if (discountNum > amount) next.discount = "More than room amount";
    }
    setErrors(next);
    if (Object.keys(next).length) toast.error("Please fix the highlighted fields");
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: BookingInput = {
      guest_name: form.guest_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      company_name: form.company_name.trim() || null,
      guest_gst_number: form.guest_gst_number.trim().toUpperCase() || null,
      rooms: lines.map((l) => ({ room_id: l.room_id, rate: Number(l.rate) })),
      check_in: form.check_in,
      check_in_time: form.check_in_time || "12:00",
      check_out: hasCheckout ? form.check_out : null,
      check_out_time: form.check_out_time || "11:00",
      guest_count: Number(form.guest_count) || 1,
      status: form.status,
      payment_method: form.payment_method,
      discount: discountNum,
      services: Object.fromEntries(
        SERVICE_KEYS.map((k) => [k, Math.max(0, Number(services[k]) || 0)])
      ) as ServiceCharges,
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

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-form-title"
    >
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6 py-2">
        <div>
          <h2 id="booking-form-title" className="text-base font-semibold tracking-tight">
            {isEdit ? `Edit booking #${booking?.id}` : "New booking"}
          </h2>
          <p className="text-xs text-muted-foreground">
            <span className="text-destructive">*</span> Name, phone, room, check-in date and rate are
            required — everything else is optional.
            {!isEdit && " Check-out is recorded later, from the booking list."}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="cursor-pointer rounded-md p-2 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground"
        >
          <X className="size-5" />
        </button>
      </header>

      {/* Body: three columns that fit one screen */}
      <form
        id="booking-form"
        onSubmit={handleSubmit}
        noValidate
        className="grid min-h-0 flex-1 grid-cols-1 content-start items-start gap-3 overflow-y-auto px-3 pb-2 pt-3 lg:grid-cols-3 lg:px-4 lg:pb-3 lg:pt-4"
      >
        {/* 1 — Guest + ID documents */}
        <div className="flex flex-col gap-3">
        <Section title="Guest">
          <Fld label="Full name" htmlFor="guest_name" required error={errors.guest_name}>
            <Input
              id="guest_name"
              className={compact}
              autoFocus={!isEdit}
              value={form.guest_name}
              onChange={(e) => set("guest_name", e.target.value)}
              placeholder="e.g. Samir Patel"
              aria-invalid={Boolean(errors.guest_name)}
            />
          </Fld>
          <div className="grid grid-cols-[2fr_3fr] gap-3">
          <Fld label="Phone number" htmlFor="phone" required error={errors.phone}>
            <Input
              id="phone"
              className={compact}
              inputMode="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+91 98765 43210"
              aria-invalid={Boolean(errors.phone)}
            />
          </Fld>
          <Fld label="Email" htmlFor="email" error={errors.email}>
            <Input
              id="email"
              type="email"
              className={compact}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="guest@example.com"
              aria-invalid={Boolean(errors.email)}
            />
          </Fld>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Company" htmlFor="company_name" error={errors.company_name}>
              <Input
                id="company_name"
                className={compact}
                value={form.company_name}
                onChange={(e) => set("company_name", e.target.value)}
              />
            </Fld>
            <Fld label="Guest GST no." htmlFor="guest_gst_number" error={errors.guest_gst_number}>
              <Input
                id="guest_gst_number"
                className={compact}
                maxLength={15}
                value={form.guest_gst_number}
                onChange={(e) => set("guest_gst_number", e.target.value)}
                placeholder="24ABCDE1234F1Z5"
                aria-invalid={Boolean(errors.guest_gst_number)}
              />
            </Fld>
          </div>
          <Fld label="Address" htmlFor="address" error={errors.address}>
            <textarea
              id="address"
              rows={2}
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Street, city, PIN"
              aria-invalid={Boolean(errors.address)}
              className="w-full resize-none rounded-lg border border-input bg-white px-3 py-2 text-sm shadow-soft placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
            />
          </Fld>
        </Section>
          <div className="shrink-0 rounded-xl border border-border bg-card p-3.5 shadow-soft">
            <DocumentsPicker
              existing={(booking?.documents ?? []).filter((d) => !removedDocIds.includes(d.id))}
              pending={newFiles}
              onAdd={(files) => setNewFiles((prev) => [...prev, ...files])}
              onRemoveExisting={(id) => setRemovedDocIds((prev) => [...prev, id])}
              onRemovePending={(i) => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))}
              onView={
                booking ? (doc) => openDocument.mutate({ bookingId: booking.id, doc }) : undefined
              }
            />
          </div>
        </div>

        {/* 2 — Stay + services */}
        <div className="flex flex-col gap-3">
          <Section title="Stay">
            <Fld label="Rooms" htmlFor="room_id" required error={errors.room_id}>
              <RoomMultiSelect
                id="room_id"
                rooms={selectableRooms}
                selected={lines.map((l) => l.room_id)}
                onChange={handleRoomsChange}
                invalid={Boolean(errors.room_id)}
              />
            </Fld>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Check-in date" htmlFor="check_in" required error={errors.check_in}>
                <Input
                  id="check_in"
                  type="date"
                  className={compact}
                  value={form.check_in}
                  onChange={(e) => set("check_in", e.target.value)}
                  aria-invalid={Boolean(errors.check_in)}
                />
              </Fld>
              <Fld label="Check-in time" htmlFor="check_in_time">
                <Input
                  id="check_in_time"
                  type="time"
                  className={compact}
                  value={form.check_in_time}
                  onChange={(e) => set("check_in_time", e.target.value)}
                />
              </Fld>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Guests" htmlFor="guest_count" error={errors.guest_count}>
                <Input
                  id="guest_count"
                  type="number"
                  min={1}
                  max={totalCapacity || undefined}
                  className={compact}
                  value={form.guest_count}
                  onChange={(e) => set("guest_count", e.target.value)}
                  aria-invalid={Boolean(errors.guest_count)}
                />
              </Fld>
              <Fld label="Status" htmlFor="booking_status">
                <Select
                  id="booking_status"
                  className={compact}
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  <option value="checked_in">Checked in</option>
                  <option value="confirmed">Reserved</option>
                  {isEdit && <option value="checked_out">Checked out</option>}
                  {isEdit && <option value="cancelled">Cancelled</option>}
                </Select>
              </Fld>
            </div>
            {isEdit && (
              <div className="grid grid-cols-2 gap-3">
                <Fld label="Check-out date" htmlFor="check_out" error={errors.check_out}>
                  <Input
                    id="check_out"
                    type="date"
                    min={form.check_in || undefined}
                    className={compact}
                    value={form.check_out}
                    onChange={(e) => set("check_out", e.target.value)}
                    aria-invalid={Boolean(errors.check_out)}
                  />
                </Fld>
                <Fld label="Check-out time" htmlFor="check_out_time" error={errors.check_out_time}>
                  <Input
                    id="check_out_time"
                    type="time"
                    className={compact}
                    value={form.check_out_time}
                    onChange={(e) => set("check_out_time", e.target.value)}
                    aria-invalid={Boolean(errors.check_out_time)}
                  />
                </Fld>
              </div>
            )}
          </Section>


          {/* Collapsed until opened */}
          <section className="rounded-xl border border-border bg-card shadow-soft">
            <button
              type="button"
              onClick={() => setServicesOpen((v) => !v)}
              aria-expanded={servicesOpen}
              aria-controls="services-panel"
              className="flex w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2.5 text-left"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Services
                <span className="ml-1.5 font-normal normal-case tracking-normal">· optional</span>
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {servicesAmount > 0 && (
                  <span className="font-medium text-foreground">{formatCurrency(servicesAmount)}</span>
                )}
                <ChevronDown className={cn("size-4 transition-transform", servicesOpen && "rotate-180")} />
              </span>
            </button>
            {servicesOpen && (
              <div id="services-panel" className="space-y-2 border-t border-border p-3">
                <div className="grid grid-cols-3 gap-3">
                  {SERVICE_KEYS.map((k) => (
                    <Fld key={k} label={`${SERVICE_LABELS[k]} ₹`} htmlFor={`svc_${k}`}>
                      <Input
                        id={`svc_${k}`}
                        type="number"
                        min={0}
                        step="0.01"
                        className="h-8"
                        value={services[k]}
                        placeholder="0"
                        onChange={(e) => {
                          setServices((prev) => ({ ...prev, [k]: e.target.value }));
                          if (errors.services) setErrors((prev) => ({ ...prev, services: undefined }));
                        }}
                      />
                    </Fld>
                  ))}
                </div>
                {errors.services && (
                  <p className="text-[11px] font-medium text-destructive">{errors.services}</p>
                )}
              </div>
            )}
          </section>
        </div>

        {/* 3 — Pricing + live bill */}
        <Section title="Pricing & payment">
          <div className="space-y-1.5">
            <div className="grid grid-cols-[3.5rem_1fr_1fr] items-end gap-2 text-xs font-medium text-slate-600">
              <span>
                Room<span className="ml-0.5 text-destructive">*</span>
              </span>
              <span>Rate / night ₹ (before tax)</span>
              <span>Rate / night ₹ (with tax)</span>
            </div>
            {lines.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                Select rooms to set their rates.
              </p>
            ) : (
              <div className="max-h-64 space-y-1.5 overflow-y-auto pr-0.5">
                {lines.map((l) => (
                  <div key={l.room_id} className="grid grid-cols-[3.5rem_1fr_1fr] items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {numberOf(l.room_id)}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-8"
                      aria-label={`Rate before tax, room ${numberOf(l.room_id)}`}
                      value={l.rate}
                      onChange={(e) => setLineRate(l.room_id, e.target.value)}
                      aria-invalid={Boolean(errors.rate)}
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-8"
                      aria-label={`Rate with tax, room ${numberOf(l.room_id)}`}
                      value={l.rate_with_tax}
                      onChange={(e) => setLineRateWithTax(l.room_id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
            {errors.rate && (
              <p className="text-[11px] font-medium leading-tight text-destructive">{errors.rate}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Discount ₹ (total)" htmlFor="discount" error={errors.discount}>
              <Input
                id="discount"
                type="number"
                min={0}
                step="0.01"
                className={compact}
                value={form.discount}
                onChange={(e) => set("discount", e.target.value)}
                aria-invalid={Boolean(errors.discount)}
              />
            </Fld>
            <Fld label="Payment method" htmlFor="payment_method">
              <Select
                id="payment_method"
                className={compact}
                value={form.payment_method}
                onChange={(e) => set("payment_method", e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Fld>
          </div>

          <div className="space-y-1 rounded-lg border border-blue-100 bg-blue-50/60 px-3.5 py-2.5 text-[13px]">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {hasCheckout
                ? `Bill · ${nights} ${nights === 1 ? "night" : "nights"}`
                : "Bill per night"}
            </p>
            <Row
              label={
                hasCheckout
                  ? `${lines.length > 1 ? `${lines.length} rooms` : "Room"} (${nights} × ${formatCurrency(rateNum)})`
                  : lines.length > 1
                    ? `Rooms (${lines.length})`
                    : "Room rate"
              }
              value={amount}
            />
            {hasCheckout && discountNum > 0 && <Row label="Discount" value={-discountNum} />}
            <Row label="Before tax" value={taxable} />
            <Row label={`CGST (${cgst}%)`} value={cgstAmt} exact />
            <Row label={`SGST (${sgst}%)`} value={sgstAmt} exact />
            {hasCheckout && servicesAmount > 0 && (
              <Row label="Services (incl. GST)" value={servicesTotal} exact />
            )}
            <div className="flex justify-between border-t border-blue-100 pt-1.5 font-semibold text-foreground">
              <span>{hasCheckout ? "Total with tax" : "Per night with tax"}</span>
              <span>{formatCurrency(hasCheckout ? total + servicesTotal : total)}</span>
            </div>
            {!hasCheckout && servicesAmount > 0 && (
              <Row label="+ Services (incl. GST)" value={servicesTotal} exact />
            )}
            {!hasCheckout && (
              <p className="pt-1 text-[11px] leading-snug text-muted-foreground">
                The final bill{discountNum > 0 ? ` and the ${formatCurrency(discountNum)} discount are` : " is"}{" "}
                worked out when the guest checks out.
              </p>
            )}
          </div>
        </Section>
      </form>

      {/* Footer */}
      <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-border bg-card px-6 py-2">
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" form="booking-form" isLoading={isSubmitting}>
          {isEdit ? "Save changes" : "Create booking"}
        </Button>
      </footer>
    </div>,
    document.body
  );
}

function Row({ label, value, exact }: { label: string; value: number; exact?: boolean }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span className="tabular-nums">{exact ? formatCurrencyExact(value) : formatCurrency(value)}</span>
    </div>
  );
}
