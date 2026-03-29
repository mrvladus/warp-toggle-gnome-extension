import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { ServiceAuthBackend, ServiceAuthErrorCode } from '../constants.js';
import { makeServiceAuthError } from './errors.js';

const SYSTEMD_BUS_NAME = 'org.freedesktop.systemd1';
const SYSTEMD_OBJECT_PATH = '/org/freedesktop/systemd1';
const SYSTEMD_MANAGER_IFACE = 'org.freedesktop.systemd1.Manager';

const SYSTEMD_METHOD_MAP = {
  start: 'StartUnit',
  stop: 'StopUnit',
  restart: 'RestartUnit',
};

/**
 * Runs a systemctl action via the systemd D-Bus Manager interface.
 * Uses ALLOW_INTERACTIVE_AUTHORIZATION so polkit can prompt the user.
 */
export async function runServiceCommandSystemdDbus(action, serviceName) {
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
