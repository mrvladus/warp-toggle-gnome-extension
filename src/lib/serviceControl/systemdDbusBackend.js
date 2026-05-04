import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { ServiceAuthBackend, ServiceAuthErrorCode } from '../warpTypes.js';
import { makeServiceAuthError } from './errors.js';

const SYSTEMD_BUS_NAME = 'org.freedesktop.systemd1';
const SYSTEMD_OBJECT_PATH = '/org/freedesktop/systemd1';
const SYSTEMD_MANAGER_IFACE = 'org.freedesktop.systemd1.Manager';

export const SYSTEMD_METHOD_MAP = {
  start: 'StartUnit',
  stop: 'StopUnit',
  restart: 'RestartUnit',
};

// D-Bus / polkit error markers used to classify failures.
const DBUS_CANCELLED_MARKERS = [
  'dismissed',
  'notauthorized',
  'interactiveauthorizationrequired',
];
const DBUS_DENIED_MARKERS = ['accessdenied', 'rejected'];

export function messageContainsAny(msg, markers) {
  const lower = msg.toLowerCase();
  return markers.some((m) => lower.includes(m));
}

export function isDbusAuthCancelled(msg) {
  return messageContainsAny(msg, DBUS_CANCELLED_MARKERS);
}

export function isDbusAuthDenied(msg) {
  return messageContainsAny(msg, DBUS_DENIED_MARKERS);
}

/**
 * Runs a systemctl action via the systemd D-Bus Manager interface.
 * Uses ALLOW_INTERACTIVE_AUTHORIZATION so polkit can prompt the user.
 */
export async function runServiceCommandSystemdDbus(
  action,
  serviceName,
  cancellable = null,
) {
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
      cancellable,
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
      cancellable,
    );
  } catch (e) {
    const msg = e.message || String(e);

    if (isDbusAuthCancelled(msg)) {
      throw makeServiceAuthError(
        msg,
        ServiceAuthErrorCode.CANCELLED,
        ServiceAuthBackend.SYSTEMD_DBUS,
      );
    }

    if (isDbusAuthDenied(msg)) {
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
