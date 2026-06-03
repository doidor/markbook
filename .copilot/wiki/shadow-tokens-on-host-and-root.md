# Shadow-root mounts need tokens declared on `:host`, not only `:root`

**Symptom:** A story rendered inside an open shadow root (via
`markbook bundle --isolation=shadow` or `mount(el, { isolation: 'shadow' })`)
appears unstyled or partially styled — typography defaults to the UA stylesheet,
colors fall back to browser defaults, theme switching has no effect inside the
shadow tree.

**Root cause:** CSS custom properties declared on `:root` apply to the document
root (the `<html>` element). They do **not** propagate into a shadow root —
inside a shadow tree, the equivalent root is `:host`, and `:root` matches
nothing inside the shadow. A token sheet like Pixie's `pixie.css` that ships
just `:root { --pixie-primary: ... }` will leave components inside the shadow
without any of those tokens.

Same with ancestor-class selectors like `[data-theme="dark"]`. The
`<html data-theme="dark">` on the host page can be reached by light-DOM
components, but inside a shadow root the selector finds nothing because the
ancestor chain stops at the shadow boundary.

**Fix:** Author token sheets with a paired selector list. Both target the same
declarations — `:root` for the document, `:host` for the shadow.

```css
/* ❌ — works only outside shadow */
:root {
  --pixie-primary: #6c5ce7;
}
[data-theme="dark"] {
  --pixie-primary: #8a7cf0;
}

/* ✅ — works in light DOM AND inside a shadow root */
:root, :host {
  --pixie-primary: #6c5ce7;
}
:root[data-theme="dark"], :host([data-theme="dark"]), [data-theme="dark"] {
  --pixie-primary: #8a7cf0;
}
```

For dark-mode propagation to actually reach inside a shadow, the **host
element** itself must carry `data-theme="dark"` — the ambient `<html>`
attribute doesn't cross the shadow boundary. The Markbook embed bundle
does not currently propagate this; if your story needs theme awareness inside
a shadow, the host page is responsible for setting `data-theme` on the
placeholder element.

**Prevention:**
- When writing a CSS file intended for component use (not chrome), pair every
  `:root` selector with `:host` from the start.
- The embed-host `shadow.html` demo (Pixie Button) is a working reference.
- Do NOT transform CSS at mount time — it's too magical and would break user
  expectations. Fix the token sheet at source.

**First observed:** 2026-06-03 session, while shipping shadow-DOM CSS injection
(see `PROGRESS.md` entry of the same date).
