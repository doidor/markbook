// Tiny placeholder substitution. Framework-agnostic.

export function renderTemplate(template, vars) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined ? '' : String(v);
  });
}
