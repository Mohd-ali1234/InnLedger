import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { settingsService } from "@/services/settings.service";
import { getApiErrorMessage } from "@/services/api";
import type { HotelSettings } from "@/types";

const KEY = ["settings"];

export function useSettings() {
  return useQuery({ queryKey: KEY, queryFn: settingsService.get });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: HotelSettings) => settingsService.update(payload),
    onSuccess: (data) => {
      qc.setQueryData(KEY, data);
      toast.success("Hotel settings saved");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not save settings")),
  });
}
