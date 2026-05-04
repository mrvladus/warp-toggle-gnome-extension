import {
  Settings,
  ServiceAuthBackend,
  ServiceAuthErrorCode,
} from '../warpTypes.js';
import { isPkexecAvailable, runServiceCommandPkexec } from './pkexecBackend.js';
import { runServiceCommandSystemdDbus } from './systemdDbusBackend.js';

const SERVICE_NAME_DEFAULT = 'warp-svc.service';

/**
 * Resolves the systemd service name from settings or falls back to the default.
 */
export function getServiceName(settings) {
  if (settings && settings.get_boolean(Settings.USE_CUSTOM_SERVICE_NAME)) {
    const custom = settings.get_string(Settings.SERVICE_NAME)?.trim();
    if (custom) return custom;
  }
  return SERVICE_NAME_DEFAULT;
}

/**
 * Determines which backend to use based on the setting value.
 * For 'auto', checks pkexec availability and falls back to systemd-dbus.
 */
export function resolveServiceBackend(settings) {
  const value = settings
    ? settings.get_string(Settings.SERVICE_AUTH_BACKEND)
    : ServiceAuthBackend.AUTO;

  if (value === ServiceAuthBackend.PKEXEC) {
    return ServiceAuthBackend.PKEXEC;
  }
  if (value === ServiceAuthBackend.SYSTEMD_DBUS) {
    return ServiceAuthBackend.SYSTEMD_DBUS;
  }

  // auto: prefer pkexec when available
  return isPkexecAvailable()
    ? ServiceAuthBackend.PKEXEC
    : ServiceAuthBackend.SYSTEMD_DBUS;
}

/**
 * Runs a systemctl action (start, stop, restart) on the WARP service.
 * Dispatches to the configured backend.
 * Returns a Promise that resolves when the command completes.
 */
export async function runServiceCommand(action, settings, cancellable = null) {
  const serviceName = getServiceName(settings);
  const backend = resolveServiceBackend(settings);

  if (backend === ServiceAuthBackend.SYSTEMD_DBUS) {
    return runServiceCommandSystemdDbus(action, serviceName, cancellable);
  }

  // pkexec path — either explicitly selected or resolved by auto
  try {
    return await runServiceCommandPkexec(action, serviceName);
  } catch (err) {
    // In auto mode, fall back to systemd-dbus only on unavailability.
    const settingValue = settings
      ? settings.get_string(Settings.SERVICE_AUTH_BACKEND)
      : ServiceAuthBackend.AUTO;

    if (
      settingValue === ServiceAuthBackend.AUTO &&
      err.code === ServiceAuthErrorCode.UNAVAILABLE
    ) {
      return runServiceCommandSystemdDbus(action, serviceName, cancellable);
    }

    throw err;
  }
}
