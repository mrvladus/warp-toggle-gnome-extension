import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {
  Settings,
  ServiceAuthBackend,
  ServiceAuthErrorCode,
} from './constants.js';

const SERVICE_NAME_DEFAULT = 'warp-svc.service';

const SYSTEMD_BUS_NAME = 'org.freedesktop.systemd1';
const SYSTEMD_OBJECT_PATH = '/org/freedesktop/systemd1';
const SYSTEMD_MANAGER_IFACE = 'org.freedesktop.systemd1.Manager';

const SYSTEMD_METHOD_MAP = {
  start: 'StartUnit',
  stop: 'StopUnit',
  restart: 'RestartUnit',
};

/**
 * Resolves the systemd service name from settings or falls back to the default.
 */
export function getServiceName(settings) {
  if (
    settings &&
    settings.get_boolean(Settings.USE_CUSTOM_SERVICE_NAME) &&
    settings.get_string(Settings.SERVICE_NAME)
  ) {
    return settings.get_string(Settings.SERVICE_NAME);
  }
  return SERVICE_NAME_DEFAULT;
}

/**
 * Returns true if the pkexec binary is found on PATH.
 */
function isPkexecAvailable() {
  return GLib.find_program_in_path('pkexec') !== null;
}

/**
 * Determines which backend to use based on the setting value.
 * For 'auto', checks pkexec availability and falls back to systemd-dbus.
 */
function resolveServiceBackend(settings) {
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
 * Creates a normalized service-auth error.
 */
function makeServiceAuthError(message, code, backend) {
  const err = new Error(message);
  err.code = code;
  err.backend = backend;
  err.cancelled = code === ServiceAuthErrorCode.CANCELLED;
  return err;
}

/**
 * Runs a systemctl action via pkexec.
 */
function runServiceCommandPkexec(action, serviceName) {
  return new Promise((resolve, reject) => {
    try {
      const proc = new Gio.Subprocess({
        argv: ['pkexec', 'systemctl', action, serviceName],
        flags:
          Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
      });
      proc.init(null);
      proc.communicate_utf8_async(null, null, (p, res) => {
        try {
          const [, , stderr] = p.communicate_utf8_finish(res);
          const exitStatus = p.get_exit_status();
          if (exitStatus === 0) {
            resolve();
            return;
          }

          const detail =
            stderr?.trim() || `Service ${action} failed (exit ${exitStatus})`;

          if (exitStatus === 126) {
            reject(
              makeServiceAuthError(
                detail,
                ServiceAuthErrorCode.CANCELLED,
                ServiceAuthBackend.PKEXEC,
              ),
            );
          } else if (exitStatus === 127) {
            reject(
              makeServiceAuthError(
                detail,
                ServiceAuthErrorCode.DENIED,
                ServiceAuthBackend.PKEXEC,
              ),
            );
          } else {
            const err = makeServiceAuthError(
              detail,
              ServiceAuthErrorCode.FAILED,
              ServiceAuthBackend.PKEXEC,
            );
            console.error(`[WARP Toggle] ${err.message}`);
            reject(err);
          }
        } catch (e) {
          console.error(`[WARP Toggle] Service ${action} error: ${e}`);
          reject(
            makeServiceAuthError(
              String(e),
              ServiceAuthErrorCode.FAILED,
              ServiceAuthBackend.PKEXEC,
            ),
          );
        }
      });
    } catch (err) {
      // Spawn failure — pkexec binary missing or not executable.
      console.error(`[WARP Toggle] Failed to ${action} service: ${err}`);
      reject(
        makeServiceAuthError(
          String(err),
          ServiceAuthErrorCode.UNAVAILABLE,
          ServiceAuthBackend.PKEXEC,
        ),
      );
    }
  });
}

/**
 * Runs a systemctl action via the systemd D-Bus Manager interface.
 * Uses ALLOW_INTERACTIVE_AUTHORIZATION so polkit can prompt the user.
 */
async function runServiceCommandSystemdDbus(action, serviceName) {
  const methodName = SYSTEMD_METHOD_MAP[action];
  if (!methodName) {
    throw makeServiceAuthError(
      `Unknown service action: ${action}`,
      ServiceAuthErrorCode.FAILED,
      ServiceAuthBackend.SYSTEMD_DBUS,
    );
  }

  let proxy;
  try {
    proxy = await Gio.DBusProxy.new_for_bus(
      Gio.BusType.SYSTEM,
      Gio.DBusProxyFlags.NONE,
      null,
      SYSTEMD_BUS_NAME,
      SYSTEMD_OBJECT_PATH,
      SYSTEMD_MANAGER_IFACE,
      null,
    );
  } catch (e) {
    throw makeServiceAuthError(
      `D-Bus proxy creation failed: ${e}`,
      ServiceAuthErrorCode.UNAVAILABLE,
      ServiceAuthBackend.SYSTEMD_DBUS,
    );
  }

  try {
    await proxy.call(
      methodName,
      new GLib.Variant('(ss)', [serviceName, 'replace']),
      Gio.DBusCallFlags.ALLOW_INTERACTIVE_AUTHORIZATION,
      -1,
      null,
    );
  } catch (e) {
    const msg = e.message || String(e);

    // Polkit interactive auth dismissed / not authorized.
    if (
      msg.includes('dismissed') ||
      msg.includes('NotAuthorized') ||
      msg.includes('InteractiveAuthorizationRequired')
    ) {
      throw makeServiceAuthError(
        msg,
        ServiceAuthErrorCode.CANCELLED,
        ServiceAuthBackend.SYSTEMD_DBUS,
      );
    }

    if (msg.includes('AccessDenied') || msg.includes('Rejected')) {
      throw makeServiceAuthError(
        msg,
        ServiceAuthErrorCode.DENIED,
        ServiceAuthBackend.SYSTEMD_DBUS,
      );
    }

    console.error(`[WARP Toggle] systemd-dbus ${action} error: ${msg}`);
    throw makeServiceAuthError(
      msg,
      ServiceAuthErrorCode.FAILED,
      ServiceAuthBackend.SYSTEMD_DBUS,
    );
  }
}

/**
 * Runs a systemctl action (start, stop, restart) on the WARP service.
 * Dispatches to the configured backend.
 * Returns a Promise that resolves when the command completes.
 */
export async function runServiceCommand(action, settings) {
  const serviceName = getServiceName(settings);
  const backend = resolveServiceBackend(settings);

  if (backend === ServiceAuthBackend.SYSTEMD_DBUS) {
    return runServiceCommandSystemdDbus(action, serviceName);
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
      return runServiceCommandSystemdDbus(action, serviceName);
    }

    throw err;
  }
}
