import { useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarPlus,
  Eye,
  LogOut,
  MoreHorizontal,
  FileText,
  Pencil,
  Printer,
  Search,
  SearchX,
  Trash2,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu, MenuItem } from "@/components/ui/DropdownMenu";
import { BookingStatusBadge } from "@/components/StatusBadge";
import { BookingFormModal } from "@/components/bookings/BookingFormModal";
import { BookingDetailsModal } from "@/components/bookings/BookingDetailsModal";
import { CheckoutModal } from "@/components/bookings/CheckoutModal";
import { BOOKING_STATUSES } from "@/utils/constants";
import { formatDate } from "@/utils/format";
import {
  useBookings,
  useCancelBooking,
  useDeleteBooking,
  useOpenInvoice,
  usePrintInvoice,
} from "@/hooks/useBookings";
import type { Booking, BookingStatus } from "@/types";

const STAT_TABS: { value: BookingStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  ...BOOKING_STATUSES.map((s) => ({ value: s.value, label: s.label })),
];

export default function BookingsPage() {
  const { data: bookings, isLoading } = useBookings();
  const cancelBooking = useCancelBooking();
  const deleteBooking = useDeleteBooking();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const openInvoice = useOpenInvoice();
  const printInvoice = usePrintInvoice();
  const [viewing, setViewing] = useState<Booking | null>(null);
  const [checkingOut, setCheckingOut] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [deleting, setDeleting] = useState<Booking | null>(null);

  const counts = useMemo(() => {
    const base: Record<string, number> = { all: bookings?.length ?? 0 };
    for (const s of BOOKING_STATUSES) base[s.value] = 0;
    for (const b of bookings ?? []) base[b.status] = (base[b.status] ?? 0) + 1;
    return base;
  }, [bookings]);

  const filtered = useMemo(() => {
    if (!bookings) return [];
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      const matchesSearch =
        !q ||
        b.guest_name.toLowerCase().includes(q) ||
        (b.email ?? "").toLowerCase().includes(q) ||
        b.phone.toLowerCase().includes(q) ||
        b.room_numbers.toLowerCase().includes(q) ||
        String(b.id) === q.replace(/^#/, "");
      const matchesStatus = statusFilter === "all" || b.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [bookings, search, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (b: Booking) => {
    setEditing(b);
    setFormOpen(true);
  };

  const hasFilters = search.trim() !== "" || statusFilter !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        subtitle="Manage reservations, check-ins, and check-outs."
        actions={
          <Button onClick={openCreate}>
            <CalendarPlus />
            New Booking
          </Button>
        }
      />

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {STAT_TABS.map((tab) => {
          const active = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer " +
                (active
                  ? "border-primary bg-primary text-primary-foreground shadow-soft"
                  : "border-border bg-white text-muted-foreground hover:bg-slate-50 hover:text-foreground")
              }
            >
              {tab.label}
              <span
                className={
                  "rounded-full px-1.5 text-xs tabular-nums " +
                  (active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600")
                }
              >
                {counts[tab.value] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by bill no., guest name, phone, email, or room…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={hasFilters ? SearchX : CalendarCheck}
          title={hasFilters ? "No bookings match your filters" : "No bookings yet"}
          description={
            hasFilters
              ? "Try a different search or status filter."
              : "Create your first reservation to get started."
          }
          action={
            hasFilters ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button onClick={openCreate}>
                <CalendarPlus />
                New Booking
              </Button>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50/80 text-left">
                  <Th>Bill No.</Th>
                  <Th>Guest</Th>
                  <Th>Room</Th>
                  <Th>Check-in</Th>
                  <Th>Check-out</Th>
                  <Th className="text-center">Nights</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((b) => (
                  <tr
                    key={b.id}
                    className="group transition-colors hover:bg-slate-50/70"
                    onClick={() => setViewing(b)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className="px-4 py-3 font-medium tabular-nums text-foreground">{b.id}</td>
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{b.guest_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{b.phone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {b.rooms.length > 1 ? "Rooms" : "Room"} {b.room_numbers}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {b.rooms.length > 1 ? `${b.rooms.length} rooms` : b.room.room_name}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(b.check_in)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {b.check_out ? (
                        <>
                          {formatDate(b.check_out)}
                          <span className="block text-xs">{b.check_out_time}</span>
                        </>
                      ) : (
                        <span className="text-xs italic">
                          {b.status === "checked_in" || b.status === "confirmed" ? "Not yet" : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                      {b.nights}
                      {!b.check_out && b.status === "checked_in" && <span className="text-xs">+</span>}
                    </td>
                    <td className="px-4 py-3">
                      <BookingStatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {(b.status === "checked_in" || b.status === "confirmed") && (
                          <Button variant="secondary" size="sm" onClick={() => setCheckingOut(b)}>
                            <LogOut />
                            Check out
                          </Button>
                        )}
                        <DropdownMenu
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label="Booking actions"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          }
                        >
                          <MenuItem icon={<Eye />} onClick={() => setViewing(b)}>
                            View details
                          </MenuItem>
                          <MenuItem icon={<Pencil />} onClick={() => openEdit(b)}>
                            Edit
                          </MenuItem>
                          <MenuItem
                            icon={<LogOut />}
                            disabled={b.status !== "checked_in" && b.status !== "confirmed"}
                            onClick={() => setCheckingOut(b)}
                          >
                            Check out
                          </MenuItem>
                          <MenuItem
                            icon={<FileText />}
                            disabled={b.status !== "checked_out"}
                            onClick={() => openInvoice.mutate(b.id)}
                          >
                            View invoice
                          </MenuItem>
                          <MenuItem
                            icon={<Printer />}
                            disabled={b.status !== "checked_out"}
                            onClick={() => printInvoice.mutate(b.id)}
                          >
                            Print invoice
                          </MenuItem>
                          <MenuItem
                            icon={<XCircle />}
                            variant="danger"
                            disabled={b.status === "cancelled" || b.status === "checked_out"}
                            onClick={() => setCancelling(b)}
                          >
                            Cancel booking
                          </MenuItem>
                          <MenuItem
                            icon={<Trash2 />}
                            variant="danger"
                            disabled={b.invoice_printed}
                            onClick={() => setDeleting(b)}
                          >
                            {b.invoice_printed ? "Delete (bill printed)" : "Delete"}
                          </MenuItem>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modals */}
      <BookingFormModal
        open={formOpen}
        booking={editing}
        onClose={() => setFormOpen(false)}
      />

      <BookingDetailsModal
        open={Boolean(viewing)}
        booking={viewing}
        onClose={() => setViewing(null)}
        onEdit={openEdit}
      />

      <CheckoutModal booking={checkingOut} onClose={() => setCheckingOut(null)} />

      <ConfirmDialog
        open={Boolean(cancelling)}
        title="Cancel booking"
        description={`Cancel the booking for ${cancelling?.guest_name} in Room ${cancelling?.room_numbers}? The room will be released if it was occupied.`}
        confirmLabel="Cancel booking"
        isLoading={cancelBooking.isPending}
        onConfirm={() =>
          cancelling &&
          cancelBooking.mutate(cancelling.id, { onSuccess: () => setCancelling(null) })
        }
        onClose={() => setCancelling(null)}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete booking"
        description={`Permanently delete the booking for ${deleting?.guest_name}? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteBooking.isPending}
        onConfirm={() =>
          deleting && deleteBooking.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={
        "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground " + className
      }
    >
      {children}
    </th>
  );
}

function TableSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        ))}
      </div>
    </Card>
  );
}
