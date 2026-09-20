import { api } from "./api";
import type { Room, RoomInput } from "@/types";

export const roomsService = {
  list: async () => (await api.get<Room[]>("/rooms")).data,
  get: async (id: number) => (await api.get<Room>(`/rooms/${id}`)).data,
  create: async (payload: RoomInput) => (await api.post<Room>("/rooms", payload)).data,
  update: async (id: number, payload: Partial<RoomInput>) =>
    (await api.put<Room>(`/rooms/${id}`, payload)).data,
  remove: async (id: number) => {
    await api.delete(`/rooms/${id}`);
  },
};
