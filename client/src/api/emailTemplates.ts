import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { EmailTemplateKind } from "../lib/emailTemplateSamples";

export interface EmailTemplate {
  id: string;
  kind: EmailTemplateKind;
  subject: string;
  body: string;
  ctaLabel: string;
  updatedAt: string;
}

export function useEmailTemplates() {
  return useQuery({
    queryKey: ["email-templates"],
    queryFn: () => apiFetch<EmailTemplate[]>("/admin/email-templates"),
  });
}

export function useUpdateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, subject, body, ctaLabel }: { kind: EmailTemplateKind; subject: string; body: string; ctaLabel: string }) =>
      apiFetch<EmailTemplate>(`/admin/email-templates/${kind}`, {
        method: "PATCH",
        body: JSON.stringify({ subject, body, ctaLabel }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-templates"] }),
  });
}

export function useSendTemplateTest() {
  return useMutation({
    mutationFn: (kind: EmailTemplateKind) =>
      apiFetch<{ ok: boolean; error?: string }>(`/admin/email-templates/${kind}/test`, { method: "POST" }),
  });
}
