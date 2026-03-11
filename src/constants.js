// Connection states — used by extension.js and warpCli.js.
export const State = {
  CONNECTED: 'connected',
  CONNECTING: 'connecting',
  DISCONNECTED: 'disconnected',
  DISABLED: 'disabled',
  NO_ROUTE: 'no_route',
  OFFLINE: 'offline',
  ERROR: 'error',
  NOT_REGISTERED: 'not_registered',
};

// GSettings key names — single source of truth for both extension.js and prefs.js.
export const Settings = {
  SHOW_INDICATOR: 'show-indicator',
  SHOW_ACCOUNT_DETAILS: 'show-account-details',
  POLL_INTERVAL: 'poll-interval',
  USE_CUSTOM_WARP_CLI: 'use-custom-warp-cli',
  CUSTOM_WARP_CLI_PATH: 'custom-warp-cli-path',
};

// Per-state indicator settings keys and display metadata, keyed by state name.
// extension.js uses state keys to look up the GSettings key;
// prefs.js iterates values for `key` + `title`.
export const IndicatorStates = {
  connected: { key: 'indicator-connected', title: 'Connected' },
  connecting: { key: 'indicator-connecting', title: 'Connecting' },
  disconnected: { key: 'indicator-disconnected', title: 'Disconnected' },
  disabled: { key: 'indicator-disabled', title: 'Service not running' },
  no_route: { key: 'indicator-no-route', title: 'No route to host' },
  offline: { key: 'indicator-offline', title: 'Offline' },
  error: { key: 'indicator-error', title: 'Error' },
  not_registered: { key: 'indicator-not-registered', title: 'Not registered' },
};
