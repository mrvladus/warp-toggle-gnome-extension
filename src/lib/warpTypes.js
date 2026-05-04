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
  SERVICE_STARTING: 'service_starting',
  SERVICE_STOPPING: 'service_stopping',
  SERVICE_RESTARTING: 'service_restarting',
};

export const Settings = {
  SHOW_INDICATOR: 'show-indicator',
  SHOW_ACCOUNT_DETAILS: 'show-account-details',
  ENABLE_QUICK_SETTINGS_DROPDOWN: 'enable-quick-settings-dropdown',
  START_SERVICE_ON_DISABLED_CLICK: 'start-service-on-disabled-click',
  SHOW_QUICK_SETTINGS_REFRESH_BUTTON: 'show-quick-settings-refresh-button',
  SHOW_QUICK_SETTINGS_SETTINGS_BUTTON: 'show-quick-settings-settings-button',
  POLL_INTERVAL: 'poll-interval',
  USE_CUSTOM_WARP_CLI: 'use-custom-warp-cli',
  CUSTOM_WARP_CLI_PATH: 'custom-warp-cli-path',
  ENABLE_CONNECTING_ANIMATION: 'enable-connecting-animation',
  USE_CUSTOM_SERVICE_NAME: 'use-custom-service-name',
  SERVICE_NAME: 'service-name',
  SERVICE_AUTH_BACKEND: 'service-auth-backend',
};

export const ServiceAuthBackend = {
  AUTO: 'auto',
  PKEXEC: 'pkexec',
  SYSTEMD_DBUS: 'systemd-dbus',
};

// Per-state indicator settings keys and display metadata, keyed by state name.
export const IndicatorStates = {
  connected: {
    key: 'indicator-connected',
    title: 'Connected',
    iconName: 'network-vpn-symbolic',
    subtitle: null,
  },
  connecting: {
    key: 'indicator-connecting',
    title: 'Connecting',
    iconName: 'network-vpn-acquiring-symbolic',
    subtitle: 'Connecting\u2026',
  },
  disconnected: {
    key: 'indicator-disconnected',
    title: 'Disconnected',
    iconName: 'network-vpn-disconnected-symbolic',
    subtitle: null,
  },
  disabled: {
    key: 'indicator-disabled',
    title: 'Service not running',
    iconName: 'network-vpn-disabled-symbolic',
    subtitle: 'Service not running',
  },
  no_route: {
    key: 'indicator-no-route',
    title: 'No route to host',
    iconName: 'network-vpn-no-route-symbolic',
    subtitle: 'No route to host',
  },
  offline: {
    key: 'indicator-offline',
    title: 'Offline',
    iconName: 'network-vpn-offline-symbolic',
    subtitle: 'Offline',
  },
  error: {
    key: 'indicator-error',
    title: 'Error',
    iconName: 'network-vpn-error-symbolic',
    subtitle: 'Unknown error',
  },
  not_registered: {
    key: 'indicator-not-registered',
    title: 'Not registered',
    iconName: 'network-vpn-no-route-symbolic',
    subtitle: 'Not registered \u00b7 Click to set up',
  },
  service_starting: {
    key: 'indicator-service-busy',
    title: 'Service activity',
    iconName: 'network-vpn-acquiring-symbolic',
    subtitle: 'Starting service\u2026',
  },
  service_stopping: {
    key: 'indicator-service-busy',
    title: 'Service activity',
    iconName: 'network-vpn-acquiring-symbolic',
    subtitle: 'Stopping service\u2026',
  },
  service_restarting: {
    key: 'indicator-service-busy',
    title: 'Service activity',
    iconName: 'network-vpn-acquiring-symbolic',
    subtitle: 'Restarting service\u2026',
  },
};

const SERVICE_TRANSITION_STATES = new Set([
  State.SERVICE_STARTING,
  State.SERVICE_STOPPING,
  State.SERVICE_RESTARTING,
]);

export function isServiceTransitionState(state) {
  return SERVICE_TRANSITION_STATES.has(state);
}

export function isLoadingState(state) {
  return state === State.CONNECTING || isServiceTransitionState(state);
}

export const ServiceAuthErrorCode = {
  CANCELLED: 'cancelled',
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
  FAILED: 'failed',
};
