// Tiny placeholder substitution. Framework-agnostic.

const PLACEHOLDER_RE = /\{\{\s*(\w+)\s*\}\}/g;

export function renderTemplate(template, vars) {
  return template.replace(PLACEHOLDER_RE, (_, key) => {
    const v = vars[key];
    return v === undefined ? '' : String(v);
  });
}
