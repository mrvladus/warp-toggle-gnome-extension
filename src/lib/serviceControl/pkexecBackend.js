import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { ServiceAuthBackend, ServiceAuthErrorCode } from '../constants.js';
import { makeServiceAuthError } from './errors.js';

/**
 * Returns true if the pkexec binary is found on PATH.
 */
export function isPkexecAvailable() {
  return GLib.find_program_in_path('pkexec') !== null;
}

/**
 * Runs a systemctl action via pkexec.
 */
export function runServiceCommandPkexec(action, serviceName) {
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
