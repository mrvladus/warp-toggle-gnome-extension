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

// Executes a shell command and returns its stdout output.
async function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Executing command: warp-cli ${cmd}`);
      const proc = new Gio.Subprocess({
        argv: ["warp-cli", cmd],
        flags:
          Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
      });
      proc.init(null);
      proc.communicate_utf8_async(null, null, (proc, res) => {
        try {
          let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
          if (!ok || proc.get_exit_status() !== 0) {
            console.error("Failed to execute warp-cli:", cmd, stderr);
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
        title: _("WARP"),
        iconName: "network-vpn-symbolic",
        toggleMode: true,
        checked: false,
      });

      this._attempts = 0;
      this._maxAttempts = 5;
      this._statusCheckId = null; // Store timeout ID

      this._updateStatus(); // Initial check
      this._startCheckingStatus(); // Start periodic updates

      // Monitor state changes
      this.connect("clicked", () => {
        this._attempts = 0;
        runCommand(this.checked ? "connect" : "disconnect");
        if (this.checked) this._startCheckingStatus(); // Restart checking when user toggles
      });
    }

    async _updateStatus() {
      try {
        const connected = await this._isWarpConnected();
        if (connected) {
          this._attempts = 0;
          this.checked = true;
          this._stopCheckingStatus(); // Stop updates when connected
        } else {
          this._attempts++;
          this.checked = false;

          if (this._attempts >= this._maxAttempts) {
            Main.notifyError("WARP Toggle", "Can't connect to WARP");
            this._attempts = 0;
          }
        }
      } catch (err) {
        console.error("Error checking Warp status:", err);
      }
    }

    _startCheckingStatus() {
      if (this._statusCheckId) return; // Prevent duplicate timers
      this._statusCheckId = GLib.timeout_add_seconds(
        GLib.PRIORITY_DEFAULT,
        10,
        () => {
          this._updateStatus();
          return GLib.SOURCE_CONTINUE;
        },
      );
    }

    _stopCheckingStatus() {
      if (this._statusCheckId) {
        GLib.source_remove(this._statusCheckId);
        this._statusCheckId = null;
      }
    }

    async _isWarpConnected() {
      try {
        const status = await runCommand("status");
        if (!status) {
          console.error("Warp status command returned empty response.");
          return false;
        }
        console.log("Warp status:", status);
        const res = status.toLowerCase();
        return res.includes("connected") || res.includes("connecting");
      } catch (err) {
        console.error("Error checking Warp status:", err);
        return false;
      }
    }

    destroy() {
      this._stopCheckingStatus();
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
      this._indicator.iconName = "network-vpn-symbolic";

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
    if (!(GLib.find_program_in_path("warp-cli") ? true : false)) {
      console.error("warp-cli command not found");
      Main.notifyError("WARP Toggle", "warp-cli command not found");
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
