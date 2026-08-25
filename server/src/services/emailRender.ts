// Renders a {{variableName}} template against a variables map. Every value
// is HTML-escaped before substitution — template text (from a trusted admin)
// passes through unescaped, but variable values (system names, comment
// authors, etc.) are user-controlled free text and must not be able to
// inject markup into an outgoing email.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderTemplate(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = variables[key];
    return value === undefined ? match : escapeHtml(value);
  });
}
