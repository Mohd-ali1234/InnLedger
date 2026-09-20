import { api } from "./api";
import type { DashboardResponse } from "@/types";

export const dashboardService = {
  get: async () => (await api.get<DashboardResponse>("/dashboard")).data,
};
