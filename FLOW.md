# State Flow

Describes how the extension determines what to display in the Quick Settings toggle.

```
enable()
  └─ cliAvailable? ──> no ──► show error notification, subtitle hidden, don't add quick button
        │ yes
        ▼
  periodic _updateStatus()  (every 10 s + on toggle click)
        │
        ├─ STATE_DISABLED      → subtitle = "Service not running"
        ├─ STATE_DISCONNECTED  → subtitle = ""
        ├─ STATE_CONNECTING    → subtitle = "Connecting…"
        ├─ STATE_NO_ROUTE      → subtitle = "No route to host"
        ├─ STATE_OFFLINE       → subtitle = "Offline"
        ├─ STATE_ERROR         → subtitle = "Unknown error"
        └─ STATE_CONNECTED
              └─ getVpnProvider()  (runs `warp-cli account`)
                    ├─ team name found    → subtitle = "<Team name>"
                    ├─ account name found → subtitle = "<Account name>"
                    ├─ email found        → subtitle = "<Email>"
                    ├─ not registered     → subtitle = "Not registered"
                    └─ default           → subtitle = "Cloudflare WARP"
```
