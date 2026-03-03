# Dev Notes

## Testing in a Nested Session

Requires the `mutter-devkit` package to be installed.

Launch a throw-away nested Wayland session with:

```bash
dbus-run-session -- gnome-shell --devkit
```

Or use the npm script:

```bash
npm run dev
```

A window opens running a full GNOME Shell session with your installed extension active. Close it when done — nothing affects your real session.

---

## State Flow

Describes how the extension determines what to display in the Quick Settings toggle.

```
enable()
  └─ cliAvailable? ──> no ──► show error notification, subtitle hidden, don't add quick button
        │ yes
        ▼
  getVpnProvider() called immediately → cached as _providerSubtitle
        │
        ▼
  periodic _updateStatus()  (every 10 s + on toggle click)
  refreshes _providerSubtitle via getVpnProvider() on each cycle
        │
        ├─ status and error-like states  → subtitle = state message (overrides provider)
        │     ├─ STATE_DISABLED      → "Service not running"
        │     ├─ STATE_CONNECTING    → "Connecting…"
        │     ├─ STATE_NO_ROUTE      → "No route to host"
        │     ├─ STATE_OFFLINE       → "Offline"
        │     └─ STATE_ERROR         → "Unknown error"
        │
        └─ normal states  → subtitle = _providerSubtitle (from getVpnProvider())
              ├─ STATE_CONNECTED
              └─ STATE_DISCONNECTED
                    └─ getVpnProvider()
                          ├─ Teams org found    → "Organization: <name>"
                          ├─ personal email     → "Personal: <email>"
                          ├─ personal acct name → "Personal: <name>"
                          ├─ not registered     → "Not registered"
                          └─ no info            → no subtitle
```
