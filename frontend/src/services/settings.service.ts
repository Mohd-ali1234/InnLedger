import { api } from "./api";
import type { HotelSettings } from "@/types";

export const settingsService = {
  get: async () => (await api.get<HotelSettings>("/settings")).data,
  update: async (payload: HotelSettings) => (await api.put<HotelSettings>("/settings", payload)).data,
};
