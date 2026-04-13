# Dev Notes

## Testing in a Nested Session

Requires the `mutter-devkit` package to be installed.

Install tooling:

```bash
npm install
```

Useful commands:

```bash
npm run dev       # install the extension and launch a nested GNOME Shell with mock-warp-cli
npm run dev:real  # install the extension and launch a nested GNOME Shell with the real warp-cli
npm run prefs     # open prefs for the installed extension from another terminal
```

`npm run dev` sets `WARP_CLI` to the bundled [`mock-warp-cli`](./mock-warp-cli), so you can test connection and registration states without a real Cloudflare WARP installation. Closing the nested GNOME Shell window leaves your main session untouched.

Service actions are not mocked. The Quick Settings service menu still runs `pkexec systemctl {start|stop|restart} <service>` against the configured systemd unit, so test those paths only when you actually want to exercise the real service and polkit flow.

If you want to wire the mock CLI up manually instead of using `npm run dev`:

```bash
./build install
export WARP_CLI=$(pwd)/mock-warp-cli
dbus-run-session -- gnome-shell --devkit
```

---

## Mock CLI (`mock-warp-cli`)

A single bash script that acts as a drop-in replacement for `warp-cli`. State is persisted in plain files under `/tmp`:

| File                              | Contents                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `/tmp/mock-warp-cli-state`        | One word: `connected` \| `disconnected` \| `connecting` \| `disabled` \| `no_route` \| `offline` \| `error` \| `not_registered` |
| `/tmp/mock-warp-cli-registration` | `org:<name>` \| `email:<addr>` \| _(empty)_                                                                                     |
| `/tmp/mock-warp-cli-delay`        | Transition delay in seconds for `connect` / `disconnect` commands. Default: `12`                                                |

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

The extension polls every 10 seconds by default, so the next poll picks up manual state changes automatically unless you use the dropdown refresh button or lower the polling interval in prefs.

### Simulating delayed connect / disconnect commands

The mock's `connect` and `disconnect` commands honor a configurable delay. This is useful for checking the loading animation and optimistic state updates.

```bash
npm run mock:delay -- 15
npm run mock:no-delay
```

With a non-zero delay:

- `connect` immediately switches the mock to `connecting`, waits, then lands on `connected`.
- `disconnect` waits, then lands on `disconnected`.

If you want to force a permanent `connecting` status until you change it again, use `npm run mock:connecting` instead of the delay setting.

### Registration / account type

```bash
npm run mock:org -- "Acme Corp"          # Teams account   -> subtitle "Org: Acme Corp"
npm run mock:personal -- "user@corp.com" # Personal account -> subtitle "Acc: user@corp.com"
npm run mock:clear-reg                   # No account linked
```

The extension resolves registration info in this order:

1. `warp-cli registration organization`
2. `warp-cli registration show`

`not_registered` is treated as a dedicated UI state unless the service itself is unavailable.

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

- **`.prettierrc`**: formatting rules: single quotes, 2-space indent, trailing commas, 80-char print width.
- **`.prettierignore`**: excludes `node_modules`, `*.zip`, and `*.svg`.

### npm scripts

```bash
npm run lint          # eslint src/
npm run format        # format all files in place
npm run format:check  # check formatting without writing
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

### Startup

1. `enable()` loads GSettings and resolves the active `warp-cli` path.
2. The extension checks whether that CLI is executable.
3. If the CLI is missing, the extension shows an error notification and initializes the shared state manager in `disabled`.
4. The extension creates a shared `WarpStateManager`.
5. The indicator is built as either:
   - `WarpMenuToggle` when the Quick Settings dropdown preference is enabled
   - `WarpQuickButton` when it is disabled
6. Changing the Quick Settings layout preferences rebuilds the indicator so the tile shape and header buttons match the new config.

### Shared state manager

`WarpStateManager` owns:

- the current connection/service state
- the cached provider subtitle
- the polling timer
- `connect` / `disconnect` commands
- service actions: `start`, `stop`, `restart`
- reactions to settings changes for polling interval, CLI path, and account-detail visibility

It emits `state-changed`, and both the indicator and the Quick Settings item subscribe to that signal independently.

### Status refresh

`refreshStatus()` fetches these in parallel:

- `warp-cli status`
- registration/provider info when `show-account-details` is enabled

The result is resolved like this:

- explicit state subtitles win for `connecting`, `disabled`, `no_route`, `offline`, `error`, `not_registered`, and the service transition states
- `connected` and `disconnected` fall back to the cached provider subtitle
- a registration result of `Not registered · Click to set up` is promoted to the dedicated `not_registered` state unless the service state is already `disabled`

Polling runs immediately on startup and then every `poll-interval` seconds. The optional dropdown refresh button can trigger the same refresh on demand.

### Quick Settings behavior

The Quick Settings item always reflects the shared state manager.

Normal click behavior:

- `connected` / `disconnected`: toggle the WARP connection
- `not_registered`: open the Cloudflare setup URL
- `disabled`: either stay inert or start the service, depending on the `start-service-on-disabled-click` preference

When the dropdown variant is enabled, the menu can also expose:

- service actions: start / stop / restart
- a refresh button in the header
- a settings button in the header

During `service_starting`, `service_stopping`, and `service_restarting`, the extension disables the normal actions until polling sees a settled post-action state.

### Indicator and animation

`WarpIndicator` owns the top-bar icon. Visibility is controlled by:

- the global `show-indicator` preference
- per-state indicator toggles in the Appearance page

`IconAnimator` is shared by both the indicator and the Quick Settings item. Animation runs only when:

- the current state is `connecting`, `service_starting`, `service_stopping`, or `service_restarting`
- `enable-connecting-animation` is enabled

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
