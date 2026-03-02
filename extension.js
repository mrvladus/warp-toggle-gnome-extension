/* WARP Toggle by Vlad Krupinskii 2025 <mrvladus@yandex.ru>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GObject from "gi://GObject";
import Gio from "gi://Gio";
import GLib from "gi://GLib";

import * as Main from "resource:///org/gnome/shell/ui/main.js";

import {
  Extension,
  gettext as _,
} from "resource:///org/gnome/shell/extensions/extension.js";
import {
  QuickToggle,
  SystemIndicator,
} from "resource:///org/gnome/shell/ui/quickSettings.js";

const WARP_TITLE = "WARP";
const WARP_ICON = "network-vpn-symbolic";
const STATUS_CHECK_INTERVAL_SECONDS = 10;

// satuses
const STATUS_CONNECTED = "Connected";
const STATUS_CONNECTING = "Connecting";

// command parameters
const WARP_CLI = "warp-cli";
const COMMAND_STATUS = "status";
const COMMAND_CONNECT = "connect";
const COMMAND_DISCONNECT = "disconnect";

// error strings
const WARP_CLI_NOT_FOUND = "warp-cli command not found";

// Executes a shell command and returns its stdout output.
async function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    try {
      const proc = new Gio.Subprocess({
        argv: [WARP_CLI, cmd],
        flags:
          Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
      });
      proc.init(null);
      proc.communicate_utf8_async(null, null, (proc, res) => {
        try {
          let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
          if (!ok || proc.get_exit_status() !== 0) {
            reject(stderr);
            return;
          }
          resolve(stdout ? stdout.trim() : "");
        } catch (e) {
          reject(e);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

const WarpToggle = GObject.registerClass(
  class WarpToggle extends QuickToggle {
    constructor() {
      super({
        title: _(WARP_TITLE),
        iconName: WARP_ICON,
        toggleMode: true,
        checked: false,
      });

      this._statusCheckId = null; // Store timeout ID
      this._updateStatus(); // Initial check
      this._startCheckingStatus(); // Start periodic updates

      // Monitor button state changes
      this.connect("clicked", () => {
        runCommand(this.checked ? COMMAND_CONNECT : COMMAND_DISCONNECT);
        if (this.checked) this._startCheckingStatus(); // Restart checking when user toggles
      });
    }

    async _updateStatus() {
      try {
        this.checked = await this._isWarpConnected();
      } catch (err) {
        // Silent failure for periodic check
      }
    }

    _startCheckingStatus() {
      if (this._statusCheckId) return; // Prevent duplicate timers
      this._statusCheckId = GLib.timeout_add_seconds(
        GLib.PRIORITY_DEFAULT,
        STATUS_CHECK_INTERVAL_SECONDS,
        () => {
          this._updateStatus();
          return GLib.SOURCE_CONTINUE;
        },
      );
    }

    async _isWarpConnected() {
      try {
        const status = await runCommand(COMMAND_STATUS);
        if (!status) {
          return false;
        }
        return (
          status.includes(STATUS_CONNECTED) || status.includes(STATUS_CONNECTING)
        );
      } catch (err) {
        return false;
      }
    }

    destroy() {
      if (this._statusCheckId) {
        GLib.source_remove(this._statusCheckId);
        this._statusCheckId = null;
      }
      super.destroy();
    }
  },
);

const WarpIndicator = GObject.registerClass(
  class WarpIndicator extends SystemIndicator {
    constructor() {
      super();
      // Create the indicator icon
      this._indicator = this._addIndicator();
      this._indicator.iconName = WARP_ICON;
      // Create the toggle button and bind its visibility to connection state
      const toggle = new WarpToggle();
      toggle.bind_property(
        "checked",
        this._indicator,
        "visible",
        GObject.BindingFlags.SYNC_CREATE,
      );
      this.quickSettingsItems.push(toggle);
    }

    destroy() {
      this.quickSettingsItems.forEach((item) => item.destroy());
      super.destroy();
    }
  },
);

export default class WARPExtension extends Extension {
  enable() {
    // Check if warp-cli exists before executing.
    if (!(GLib.find_program_in_path(WARP_CLI) ? true : false)) {
      console.error(WARP_CLI_NOT_FOUND);
      Main.notifyError(`${WARP_TITLE} Toggle`, WARP_CLI_NOT_FOUND);
      return;
    }
    // Add the indicator to the system panel
    this._indicator = new WarpIndicator();
    Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
  }

  disable() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }
}
