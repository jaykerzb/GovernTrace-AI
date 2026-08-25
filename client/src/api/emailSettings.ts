import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";

export type EmailProvider = "DISABLED" | "SMTP" | "API";

export interface EmailSettings {
  id: string;
  provider: EmailProvider;
  fromName: string;
  fromAddress: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  hasSmtpPassword: boolean;
  hasApiKey: boolean;
  updatedAt: string;
}

export interface EmailSettingsUpdate {
  provider?: EmailProvider;
  fromName?: string;
  fromAddress?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean;
  smtpUser?: string | null;
  // Omit or send "" to leave the stored secret unchanged.
  smtpPassword?: string;
  apiKey?: string;
}

export function useEmailSettings() {
  return useQuery({
    queryKey: ["email-settings"],
    queryFn: () => apiFetch<EmailSettings>("/admin/email-settings"),
  });
}

export function useUpdateEmailSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: EmailSettingsUpdate) =>
      apiFetch<EmailSettings>("/admin/email-settings", { method: "PATCH", body: JSON.stringify(update) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-settings"] }),
  });
}

export function useSendTestEmail() {
  return useMutation({
    mutationFn: () => apiFetch<{ ok: boolean; error?: string }>("/admin/email-settings/test", { method: "POST" }),
  });
}
