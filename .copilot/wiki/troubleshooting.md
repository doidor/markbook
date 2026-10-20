# Troubleshooting — common errors and fixes

A shared, living list of errors agents (and humans) hit in this repo and the fix that worked. Prefer
adding here over re-debugging the same thing twice. Keep each entry tight.

## Format
```
### <error message or symptom, greppable>
- **When:** the situation it shows up in
- **Fix:** the exact thing that resolves it
```

## Entries

### Headless CDP Enter does not activate a focused copy button
- **Symptom:** The setup-prompt clipboard check read an empty string even though the button had focus.
- **Cause:** `Input.dispatchKeyEvent` with Enter key metadata alone did not trigger native button activation in headless Edge.
- **Fix:** Include `text: '\r'` on the Enter `keyDown` event; the same focused button then copies the exact prompt and shows "Copied!".
- **Prevention:** For CDP keyboard checks, send the character payload and verify both activation feedback and actual clipboard content.
- **Discovered:** 2026-10-20 while verifying the landing-page agent prompt.
