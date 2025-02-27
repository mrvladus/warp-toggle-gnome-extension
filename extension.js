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
  let fullPath = GLib.find_program_in_path(command);
  if (fullPath) {
    return true;
  }
  return false;
}

/**
 * Executes a shell command and returns its stdout output.
 */
function runCommand(cmd) {
  try {
    let [success, stdout, stderr, exit_status] =
      GLib.spawn_command_line_sync(cmd);
    let decoder = new TextDecoder();
    if (!success) {
      console.log(
        `Command failed with error output: ${stderr && decoder.decode(stderr)}`,
      );
      return null;
    }
    return decoder.decode(stdout).trim();
  } catch (e) {
    console.log(e);
    return null;
  }
}

/**
 * Checks if Warp is connected by parsing the output of "warp-cli status".
 * You might want to adjust the parsing according to your warp-cli version.
 */
function isWarpConnected() {
  let status = runCommand("warp-cli status");
  if (status && status.toLowerCase().includes("connected")) {
    return true;
  }
  return false;
}

const WarpToggle = GObject.registerClass(
  class WarpToggle extends QuickToggle {
    constructor() {
      super({
        title: _("WARP"),
        iconName: "network-vpn-symbolic",
        toggleMode: true,
        checked: isWarpConnected(),
      });

      // Monitor state changes
      this.connect("clicked", () => {
        this._toggleWarp();
      });
    }

    /**
     * Executes connect/disconnect command based on the current state.
     */
    _toggleWarp() {
      // Read the current checked state.
      let checked = this.checked;
      let cmd = checked ? "warp-cli connect" : "warp-cli disconnect";
      console.log(`Executing command: ${cmd}`);
      let result = runCommand(cmd);
      if (result) {
        console.log(`Command output: ${result}`);
      } else {
        console.log(
          "Command did not return any output. Check logs for errors.",
        );
      }
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
