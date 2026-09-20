import { api } from "./api";
import type { Admin } from "@/types";

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export const authService = {
  login: async (username: string, password: string) => {
    const { data } = await api.post<LoginResponse>("/login", { username, password });
    return data;
  },
  me: async () => {
    const { data } = await api.get<Admin>("/me");
    return data;
  },
};
