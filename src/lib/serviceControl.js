import Gio from 'gi://Gio';

import { Settings } from './constants.js';

const SERVICE_NAME_DEFAULT = 'warp-svc.service';

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
 * Runs a systemctl action (start, stop, restart) on the WARP service via pkexec.
 * Returns a Promise that resolves when the command completes.
 */
export function runServiceCommand(action, settings) {
  const serviceName = getServiceName(settings);

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
          if (exitStatus !== 0) {
            const err = new Error(
              stderr?.trim() || `Service ${action} failed (exit ${exitStatus})`,
            );
            err.cancelled = exitStatus === 126;
            if (!err.cancelled) {
              console.error(`[WARP Toggle] ${err.message}`);
            }
            reject(err);
          } else {
            resolve();
          }
        } catch (e) {
          console.error(`[WARP Toggle] Service ${action} error: ${e}`);
          reject(e);
        }
      });
    } catch (err) {
      console.error(`[WARP Toggle] Failed to ${action} service: ${err}`);
      reject(err);
    }
  });
}
