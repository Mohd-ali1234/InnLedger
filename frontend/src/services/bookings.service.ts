import { api } from "./api";
import type { Booking, BookingDocument, BookingInput } from "@/types";

export const bookingsService = {
  list: async () => (await api.get<Booking[]>("/bookings")).data,
  get: async (id: number) => (await api.get<Booking>(`/bookings/${id}`)).data,
  create: async (payload: BookingInput) =>
    (await api.post<Booking>("/bookings", payload)).data,
  update: async (id: number, payload: Partial<BookingInput>) =>
    (await api.put<Booking>(`/bookings/${id}`, payload)).data,
  remove: async (id: number) => {
    await api.delete(`/bookings/${id}`);
  },
  /** Fetch the tax-invoice PDF (auth header required, so not a plain link). */
  invoice: async (id: number) =>
    (await api.get<Blob>(`/bookings/${id}/invoice`, { responseType: "blob" })).data,
  uploadDocuments: async (id: number, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    const { data } = await api.post<BookingDocument[]>(`/bookings/${id}/documents`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  /** Fetch a stored document (auth header required, so not a plain link). */
  documentBlob: async (id: number, docId: number) =>
    (await api.get<Blob>(`/bookings/${id}/documents/${docId}`, { responseType: "blob" })).data,
  deleteDocument: async (id: number, docId: number) => {
    await api.delete(`/bookings/${id}/documents/${docId}`);
  },
};
