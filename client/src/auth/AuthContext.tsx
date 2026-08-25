import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, ApiError } from "../api/client";
import type { Role, User } from "../api/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (input: { name: string; email: string; emailNotificationsEnabled?: boolean }) => Promise<void>;
  changePassword: (input: { currentPassword: string; newPassword: string }) => Promise<void>;
  deactivateAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<User>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const u = await apiFetch<User>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(u);
  }

  async function logout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
    }
    setUser(null);
  }

  async function updateProfile(input: { name: string; email: string; emailNotificationsEnabled?: boolean }) {
    const u = await apiFetch<User>("/auth/me", { method: "PATCH", body: JSON.stringify(input) });
    setUser(u);
  }

  async function changePassword(input: { currentPassword: string; newPassword: string }) {
    await apiFetch("/auth/change-password", { method: "POST", body: JSON.stringify(input) });
  }

  async function deactivateAccount() {
    await apiFetch("/auth/deactivate", { method: "POST" });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateProfile, changePassword, deactivateAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// canManageSystems/canRunAssessments/canFinalizeAssessments/canChangeStatus
// used to live here as static role→boolean maps. They're now admin-editable
// privileges (see the Roles admin tab) sourced live from usePermissions()
// (client/src/api/permissions.ts) instead — isAdmin stays a plain identity
// check since admin-ness itself isn't a togglable privilege.
export function isAdmin(role: Role) {
  return role === "ADMIN";
}
