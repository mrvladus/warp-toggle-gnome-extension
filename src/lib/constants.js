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

export const Settings = {
  SHOW_INDICATOR: 'show-indicator',
  SHOW_ACCOUNT_DETAILS: 'show-account-details',
  POLL_INTERVAL: 'poll-interval',
  USE_CUSTOM_WARP_CLI: 'use-custom-warp-cli',
  CUSTOM_WARP_CLI_PATH: 'custom-warp-cli-path',
};

// Per-state indicator settings keys and display metadata, keyed by state name.
export const IndicatorStates = {
  connected: {
    key: 'indicator-connected',
    title: 'Connected',
    iconName: 'network-vpn-symbolic',
  },
  connecting: {
    key: 'indicator-connecting',
    title: 'Connecting',
    iconName: 'network-vpn-acquiring-symbolic',
  },
  disconnected: {
    key: 'indicator-disconnected',
    title: 'Disconnected',
    iconName: 'network-vpn-disconnected-symbolic',
  },
  disabled: {
    key: 'indicator-disabled',
    title: 'Service not running',
    iconName: 'network-vpn-disabled-symbolic',
  },
  no_route: {
    key: 'indicator-no-route',
    title: 'No route to host',
    iconName: 'network-vpn-no-route-symbolic',
  },
  offline: {
    key: 'indicator-offline',
    title: 'Offline',
    iconName: 'network-vpn-offline-symbolic',
  },
  error: {
    key: 'indicator-error',
    title: 'Error',
    iconName: 'network-vpn-error-symbolic',
  },
  not_registered: {
    key: 'indicator-not-registered',
    title: 'Not registered',
    iconName: 'network-vpn-no-route-symbolic',
  },
};
