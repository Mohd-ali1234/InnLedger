import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { bookingsService } from "@/services/bookings.service";
import { getApiErrorMessage } from "@/services/api";
import type { BookingDocument, BookingInput } from "@/types";

const KEY = ["bookings"];

function useInvalidateRelated() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ["rooms"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useBookings() {
  return useQuery({ queryKey: KEY, queryFn: bookingsService.list });
}

export function useCreateBooking() {
  const invalidate = useInvalidateRelated();
  return useMutation({
    mutationFn: (payload: BookingInput) => bookingsService.create(payload),
    onSuccess: () => {
      invalidate();
      toast.success("Booking created");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not create booking")),
  });
}

export function useUpdateBooking() {
  const invalidate = useInvalidateRelated();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<BookingInput> }) =>
      bookingsService.update(id, payload),
    onSuccess: () => {
      invalidate();
      toast.success("Booking updated");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not update booking")),
  });
}

export function useCancelBooking() {
  const invalidate = useInvalidateRelated();
  return useMutation({
    mutationFn: (id: number) => bookingsService.update(id, { status: "cancelled" }),
    onSuccess: () => {
      invalidate();
      toast.success("Booking cancelled");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not cancel booking")),
  });
}

export function useDeleteBooking() {
  const invalidate = useInvalidateRelated();
  return useMutation({
    mutationFn: (id: number) => bookingsService.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success("Booking deleted");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not delete booking")),
  });
}

/** Download-and-open the invoice PDF for a booking. */
export function useOpenInvoice() {
  return useMutation({
    mutationFn: async (id: number) => {
      const blob = await bookingsService.invoice(id);
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) {
        // Popup blocked: fall back to a download.
        const a = document.createElement("a");
        a.href = url;
        a.download = `invoice-${id}.pdf`;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not generate the invoice")),
  });
}

/** Open a stored ID document in a new tab. */
export function useOpenDocument() {
  return useMutation({
    mutationFn: async ({ bookingId, doc }: { bookingId: number; doc: BookingDocument }) => {
      const blob = await bookingsService.documentBlob(bookingId, doc.id);
      const url = URL.createObjectURL(new Blob([blob], { type: doc.content_type }));
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not open the document")),
  });
}
