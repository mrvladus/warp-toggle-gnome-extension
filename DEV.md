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

The `dev` script automatically sets `WARP_CLI` to the bundled `mock-warp-cli` stub so you can test all extension states without a real Cloudflare WARP installation.

---

## Mock CLI (`mock-warp-cli`)

A single bash script that acts as a drop-in replacement for `warp-cli`. State is persisted in two plain files under `/tmp`:

| File                              | Contents                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `/tmp/mock-warp-cli-state`        | One word: `connected` \| `disconnected` \| `connecting` \| `disabled` \| `no_route` \| `offline` \| `error` \| `not_registered` |
| `/tmp/mock-warp-cli-registration` | `org:<name>` \| `email:<addr>` \| _(empty)_                                                                                     |

### Switching state

Use npm scripts from a second terminal while the nested session is running:

```bash
npm run mock:connected
npm run mock:disconnected
npm run mock:connecting
npm run mock:disabled
npm run mock:no_route
npm run mock:offline
npm run mock:error
npm run mock:not_registered
```

or you can run the mock cli script directly:

```bash
./mock-warp-cli set-state connected
./mock-warp-cli set-state disconnected
./mock-warp-cli set-state connecting
./mock-warp-cli set-state disabled
./mock-warp-cli set-state no_route
./mock-warp-cli set-state offline
./mock-warp-cli set-state error
./mock-warp-cli set-state not_registered
```

The extension polls every 10 s, so the next poll picks up the new state automatically.

### Registration / account type

```bash
npm run mock:org -- "Acme Corp"          # Teams account   → subtitle "Org: Acme Corp"
npm run mock:personal -- "user@corp.com" # Personal account → subtitle "Acc: user@corp.com"
npm run mock:clear-reg                   # No account linked
```

### Inspect current mock state

```bash
npm run mock:show
```

### Wiring it up manually (without `npm run dev`)

```bash
./build install
export WARP_CLI=$(pwd)/mock-warp-cli
dbus-run-session -- gnome-shell --devkit
```

---

## Code Formatting (Prettier + Husky)

[Prettier](https://prettier.io/) is used to enforce a consistent code style across all source files.

### Configuration

- **`.prettierrc`** — formatting rules: single quotes, 2-space indent, trailing commas, 80-char print width.
- **`.prettierignore`** — excludes `node_modules` and `*.zip` from formatting.

### npm scripts

```bash
npm run format        # format all files in-place
npm run format:check  # check formatting without writing (used in CI / pre-commit)
```

### Pre-commit hook (Husky)

[Husky](https://typicode.com/husky) runs `npx prettier --check .` automatically before every commit. If any file is not properly formatted, the commit is blocked.

To fix formatting before committing:

```bash
npm run format
git add -u
git commit ...
```

The hook lives in `.husky/pre-commit`. To install it, just run:

```bash
npm install
```

The `prepare` script in `package.json` runs `husky` automatically as part of every `npm install`, so the git hook is registered in your local clone without any extra steps.

---

## State Flow

Describes how the extension determines what to display in the Quick Settings toggle.

```
enable()
  └─ cliAvailable? ──► no ──► show error notification, subtitle hidden, don't add quick button
        │ yes
        ▼
  getVpnProvider() called immediately → cached as _providerSubtitle
        │
        ▼
  periodic _updateStatus()  (every 10 s + on toggle click)
  refreshes _providerSubtitle via getVpnProvider() on each cycle
        │
        ├─ status and error-like states  → subtitle = state message (overrides provider)
        │     ├─ STATE_DISABLED        → "Service not running" (toggle non-reactive)
        │     ├─ STATE_CONNECTING      → "Connecting…"
        │     ├─ STATE_NO_ROUTE        → "No route to host"
        │     ├─ STATE_OFFLINE         → "Offline"
        │     ├─ STATE_ERROR           → "Unknown error"
        │     └─ STATE_NOT_REGISTERED  → "Not registered · Click to set up"
        │                                  click → opens setup URL in browser
        │
        └─ normal states  → subtitle = _providerSubtitle
              ├─ STATE_CONNECTED
              └─ STATE_DISCONNECTED
                    └─ getVpnProvider()
                          ├─ Teams org found    → "Org: <name>"
                          ├─ personal email     → "Acc: <email>"
                          ├─ personal acct name → "Acc: <name>"
                          ├─ not registered     → STATE_NOT_REGISTERED
                          └─ no info            → no subtitle
```
