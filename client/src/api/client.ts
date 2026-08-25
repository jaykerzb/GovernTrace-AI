export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function humanizeField(key: string): string {
  const cleaned = key.replace(/Id$/, "");
  const spaced = cleaned.replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Turns a zod .flatten() error shape ({ formErrors, fieldErrors }) into a
// short, readable sentence instead of dumping the raw object as JSON.
function formatValidationError(errorField: unknown): string | null {
  if (!errorField || typeof errorField !== "object") return null;
  const flat = errorField as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
  if (!flat.fieldErrors && !flat.formErrors) return null;

  const parts: string[] = [];
  if (flat.formErrors?.length) parts.push(...flat.formErrors);
  if (flat.fieldErrors) {
    for (const [field, messages] of Object.entries(flat.fieldErrors)) {
      if (!messages || messages.length === 0) continue;
      const label = humanizeField(field);
      const isEmptyCheck = /must contain at least 1 character|Required/i.test(messages[0]);
      parts.push(`${label} ${isEmptyCheck ? "is required" : messages[0]}`);
    }
  }
  return parts.length ? parts.join("; ") : null;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;

  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      // Let the browser set the multipart Content-Type (with boundary) itself.
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message =
        typeof body.error === "string" ? body.error : formatValidationError(body.error) ?? JSON.stringify(body.error ?? body);
    } catch {
      // no JSON body
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
