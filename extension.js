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

/**
 * Checks if the given command exists in the system PATH.
 */
function commandExists(command) {
  return GLib.find_program_in_path(command) ? true : false;
}

/**
 * Executes a shell command and returns its stdout output.
 */
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

/**
 * Checks if Warp is connected by parsing the output of "warp-cli status".
 * You might want to adjust the parsing according to your warp-cli version.
 */
async function isWarpConnected() {
  try {
    const status = await runCommand("status");
    if (!status) {
      console.log("Warp status command returned empty response.");
      return false;
    }
    console.log("Warp status:", status);
    return status.toLowerCase().includes("connected");
  } catch (err) {
    console.error("Error checking Warp status:", err);
    return false;
  }
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
      // Set button state
      isWarpConnected()
        .then((connected) => {
          this.checked = connected;
        })
        .catch((err) => {
          console.error("Error checking Warp status:", err);
        });

      // Monitor state changes
      this.connect("clicked", () => {
        runCommand(this.checked ? "connect" : "disconnect");
      });
    }
  },
);

const WarpIndicator = GObject.registerClass(
  class WarpIndicator extends SystemIndicator {
    constructor() {
      super();

      this._indicator = this._addIndicator();
      this._indicator.iconName = "network-vpn-symbolic";

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
    if (!commandExists("warp-cli")) {
      console.log("warp-cli command not found.");
      return;
    }

    this._indicator = new WarpIndicator();
    Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
  }

  disable() {
    this._indicator.destroy();
    this._indicator = null;
  }
}
