import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { roomsService } from "@/services/rooms.service";
import { getApiErrorMessage } from "@/services/api";
import type { RoomInput } from "@/types";

const KEY = ["rooms"];

export function useRooms() {
  return useQuery({ queryKey: KEY, queryFn: roomsService.list });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RoomInput) => roomsService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Room created");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not create room")),
  });
}

export function useUpdateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<RoomInput> }) =>
      roomsService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Room updated");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not update room")),
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => roomsService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Room deleted");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not delete room")),
  });
}
