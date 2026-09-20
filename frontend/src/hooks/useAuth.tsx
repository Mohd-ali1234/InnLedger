import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authService } from "@/services/auth.service";
import { tokenStore } from "@/services/api";
import type { Admin } from "@/types";

interface AuthContextValue {
  admin: Admin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, restore the session if a token exists.
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setIsLoading(false);
      return;
    }
    authService
      .me()
      .then(setAdmin)
      .catch(() => tokenStore.clear())
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { access_token } = await authService.login(username, password);
    tokenStore.set(access_token);
    const me = await authService.me();
    setAdmin(me);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setAdmin(null);
  }, []);

  const value = useMemo(
    () => ({
      admin,
      isAuthenticated: Boolean(admin),
      isLoading,
      login,
      logout,
    }),
    [admin, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
