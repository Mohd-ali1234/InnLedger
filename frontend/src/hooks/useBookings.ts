import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { bookingsService } from "@/services/bookings.service";
import { getApiErrorMessage } from "@/services/api";
import type { BookingDocument, BookingInput, CheckoutInput } from "@/types";

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

/** Records the departure date/time and marks the booking checked out. */
export function useCheckoutBooking() {
  const invalidate = useInvalidateRelated();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CheckoutInput }) =>
      bookingsService.checkout(id, payload),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not check out")),
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

/** Open the invoice PDF in a new tab. Viewing never locks the bill. */
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
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not open the invoice")),
  });
}

/** Open the print dialog for the invoice. Once printed, the bill can no longer be deleted. */
export function usePrintInvoice() {
  const invalidate = useInvalidateRelated();
  return useMutation({
    mutationFn: async (id: number) => {
      const blob = await bookingsService.printInvoice(id);
      const url = URL.createObjectURL(blob);

      // Load the PDF into a hidden frame and print just that, without leaving the page.
      const frame = document.createElement("iframe");
      frame.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;";
      frame.src = url;
      const cleanup = () => {
        frame.remove();
        URL.revokeObjectURL(url);
      };
      frame.onload = () => {
        // Give the built-in PDF viewer a moment to render before printing.
        setTimeout(() => {
          try {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
          } catch {
            // Printing from a frame isn't available: open the PDF so it can be printed from there.
            window.open(url, "_blank");
          }
          setTimeout(cleanup, 120_000);
        }, 500);
      };
      document.body.appendChild(frame);
    },
    // The bill is locked against deletion as soon as it has been sent to print.
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not print the invoice")),
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
