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
const STATUS_CHECK_INTERVAL_SECONDS = 10;

// states
const STATE_CONNECTED = "connected";
const STATE_CONNECTING = "connecting";
const STATE_DISCONNECTED = "disconnected";
const STATE_DISABLED = "disabled";
const STATE_NO_ROUTE = "no_route";
const STATE_OFFLINE = "offline";
const STATE_ERROR = "error";
const STATE_NOT_REGISTERED = "not_registered";

// icons and states
const ICON_CONNECTED = "network-vpn-symbolic";
const ICON_CONNECTING = "network-vpn-acquiring-symbolic";
const ICON_DISCONNECTED = "network-vpn-disconnected-symbolic";
const ICON_DISABLED = "network-vpn-disabled-symbolic";
const ICON_NO_ROUTE = "network-vpn-no-route-symbolic";
const ICON_OFFLINE = "network-vpn-offline-symbolic";
const ICON_ERROR = "network-vpn-error-symbolic";

const STATUS_CONNECTED = "connected";
const STATUS_CONNECTING = "connecting";
const STATUS_DISCONNECTED = "disconnected";

// command parameters
const WARP_CLI = "warp-cli";
const COMMAND_STATUS = "status";
const COMMAND_CONNECT = "connect";
const COMMAND_DISCONNECT = "disconnect";
const COMMAND_REGISTRATION_ORG = "registration organization";
const COMMAND_REGISTRATION_SHOW = "registration show";

// registration setup URL
const URL_SETUP_GUIDE = "https://developers.cloudflare.com/warp-client/get-started/linux/";

// subtitles
const SUBTITLE_CONNECTING = "Connecting\u2026";
const SUBTITLE_SERVICE_NOT_RUNNING = "Service not running";
const SUBTITLE_NO_ROUTE = "No route to host";
const SUBTITLE_OFFLINE = "Offline";
const SUBTITLE_ERROR = "Unknown error";

const SUBTITLE_NOT_REGISTERED = "Not registered \u00b7 Click to set up";
const SUBTITLE_PREFIX_ORG = "Org: ";
const SUBTITLE_PREFIX_PERSONAL = "Acc: ";

// error strings
const WARP_CLI_NOT_FOUND = "warp-cli command not found";

const DISABLED_ERROR_PATTERNS = [
  "no such file or directory",
  "failed to execute child process",
  "unable to connect",
  "daemon",
  "service not running",
];

const NO_ROUTE_ERROR_PATTERNS = [
  "network is unreachable",
  "no route to host",
  "could not resolve host",
  "name or service not known",
];

const OFFLINE_ERROR_PATTERNS = [
  "offline",
  "timed out",
];

function getStateAppearance(state) {
  switch (state) {
    case STATE_CONNECTED:
      return { iconName: ICON_CONNECTED, checked: true, visible: true };
    case STATE_CONNECTING:
      return { iconName: ICON_CONNECTING, checked: true, visible: true };
    case STATE_DISCONNECTED:
      return { iconName: ICON_DISCONNECTED, checked: false, visible: true };
    case STATE_DISABLED:
      return { iconName: ICON_DISABLED, checked: false, visible: true };
    case STATE_NO_ROUTE:
      return { iconName: ICON_NO_ROUTE, checked: false, visible: true };
    case STATE_OFFLINE:
      return { iconName: ICON_OFFLINE, checked: false, visible: true };
    case STATE_NOT_REGISTERED:
      return { iconName: ICON_DISCONNECTED, checked: false, visible: true };
    case STATE_ERROR:
    default:
      return { iconName: ICON_ERROR, checked: false, visible: true };
  }
}

function getStateSubtitle(state) {
  switch (state) {
    case STATE_CONNECTING:
      return SUBTITLE_CONNECTING;
    case STATE_DISABLED:
      return SUBTITLE_SERVICE_NOT_RUNNING;
    case STATE_NO_ROUTE:
      return SUBTITLE_NO_ROUTE;
    case STATE_OFFLINE:
      return SUBTITLE_OFFLINE;
    case STATE_NOT_REGISTERED:
      return SUBTITLE_NOT_REGISTERED;
    case STATE_ERROR:
      return SUBTITLE_ERROR;
    default:
      return null;
  }
}

// Fetches the VPN provider label via `warp-cli registration organization`
// (Teams) or `registration show` (personal).
// Returns a prefixed string: "Organization: <name>" or "Personal: <name>",
// SUBTITLE_NOT_REGISTERED when no account is linked yet, or null when no
// identifiable info is available.
async function getVpnProvider() {
  const isNotRegistered = (msg) =>
    msg.includes("not registered") || msg.includes("registration missing");

  try {
    const org = await runCommand(COMMAND_REGISTRATION_ORG);
    if (org) {
      return SUBTITLE_PREFIX_ORG + org;
    }
  } catch (err) {
    if (isNotRegistered(`${err}`.toLowerCase())) {
      return SUBTITLE_NOT_REGISTERED;
    }
    // Not a Teams account — fall through to registration show
  }

  try {
    const info = await runCommand(COMMAND_REGISTRATION_SHOW);
    const orgMatch = info.match(/^organization:\s*(.+)/im);
    if (orgMatch) {
      return SUBTITLE_PREFIX_ORG + orgMatch[1].trim();
    }
    // Try personal account identifiers
    const emailMatch = info.match(/^email:\s*(.+)/im);
    if (emailMatch) {
      return SUBTITLE_PREFIX_PERSONAL + emailMatch[1].trim();
    }
    const accountMatch = info.match(/^account name:\s*(.+)/im);
    if (accountMatch) {
      return SUBTITLE_PREFIX_PERSONAL + accountMatch[1].trim();
    }
    // Personal account but no identifiable info
    return null;
  } catch (err) {
    if (isNotRegistered(`${err}`.toLowerCase())) {
      return SUBTITLE_NOT_REGISTERED;
    }
    return null;
  }
}

function parseWarpStatus(statusOutput) {
  if (!statusOutput) {
    return STATE_ERROR;
  }

  const status = statusOutput.toLowerCase();
  if (status.includes(STATUS_DISCONNECTED)) {
    return STATE_DISCONNECTED;
  }
  if (status.includes(STATUS_CONNECTING)) {
    return STATE_CONNECTING;
  }
  if (status.includes(STATUS_CONNECTED)) {
    return STATE_CONNECTED;
  }
  if (DISABLED_ERROR_PATTERNS.some((pattern) => status.includes(pattern))) {
    return STATE_DISABLED;
  }
  if (NO_ROUTE_ERROR_PATTERNS.some((pattern) => status.includes(pattern))) {
    return STATE_NO_ROUTE;
  }
  if (OFFLINE_ERROR_PATTERNS.some((pattern) => status.includes(pattern))) {
    return STATE_OFFLINE;
  }

  return STATE_ERROR;
}

function classifyWarpFailure(err) {
  const message = `${err}`.toLowerCase();
  if (DISABLED_ERROR_PATTERNS.some((pattern) => message.includes(pattern))) {
    return STATE_DISABLED;
  }
  if (NO_ROUTE_ERROR_PATTERNS.some((pattern) => message.includes(pattern))) {
    return STATE_NO_ROUTE;
  }
  if (OFFLINE_ERROR_PATTERNS.some((pattern) => message.includes(pattern))) {
    return STATE_OFFLINE;
  }
  return STATE_ERROR;
}

// Executes a shell command and returns its stdout output.
async function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    try {
      const proc = new Gio.Subprocess({
        argv: [WARP_CLI, ...cmd.split(" ")],
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
    constructor(cliAvailable, onStateChange) {
      super({
        title: _(WARP_TITLE),
        iconName: ICON_DISCONNECTED,
        toggleMode: true,
        checked: false,
      });

      this._onStateChange = onStateChange;
      this._state = null;
      this._cliAvailable = cliAvailable;
      this._statusCheckId = null; // Store timeout ID
      this._providerSubtitle = null; // Cached provider label

      if (!this._cliAvailable) {
        this._setState(STATE_DISABLED);
        return;
      }

      // Fetch provider label immediately so it shows before the first status poll
      getVpnProvider().then((p) => {
        this._providerSubtitle = p;
        if (!getStateSubtitle(this._state)) {
          this.subtitle = p;
        }
      }).catch(() => {});

      this._setState(STATE_DISCONNECTED);
      this._updateStatus(); // Initial check
      this._startCheckingStatus(); // Start periodic updates

      // Monitor button state changes
      this.connect("clicked", async () => {
        if (this._notRegistered) {
          Gio.AppInfo.launch_default_for_uri(URL_SETUP_GUIDE, null);
          return;
        }

        const command = this.checked ? COMMAND_CONNECT : COMMAND_DISCONNECT;
        this._setState(
          command === COMMAND_CONNECT ? STATE_CONNECTING : STATE_DISCONNECTED,
        );

        try {
          await runCommand(command);
        } catch (err) {
          this._setState(classifyWarpFailure(err));
          return;
        }

        await this._updateStatus();
      });
    }

    _setState(state) {
      if (this._state === state) {
        return;
      }

      this._state = state;
      const appearance = getStateAppearance(state);
      this.iconName = appearance.iconName;
      this.checked = appearance.checked;
      this.visible = appearance.visible;
      // QuickToggle is a Clutter actor; `reactive` controls whether it accepts pointer input.
      this.reactive = state !== STATE_DISABLED;
      this._notRegistered = state === STATE_NOT_REGISTERED;
      // Error-like states show their own subtitle; normal states restore the provider label.
      this.subtitle = getStateSubtitle(state) ?? this._providerSubtitle;

      if (this._onStateChange) {
        this._onStateChange(appearance);
      }
    }

    async _updateStatus() {
      try {
        // TODO: not ideal running Promise.all and the vpn provider here all the time
        const [state, provider] = await Promise.all([
          this._getWarpState(),
          getVpnProvider(),
        ]);
        if (provider === SUBTITLE_NOT_REGISTERED && state !== STATE_DISABLED) {
          this._providerSubtitle = null;
          this._setState(STATE_NOT_REGISTERED);
        } else {
          this._providerSubtitle = provider;
          this._setState(state);
        }
      } catch (err) {
        this._setState(classifyWarpFailure(err));
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

    async _getWarpState() {
      const status = await runCommand(COMMAND_STATUS);
      return parseWarpStatus(status);
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
    constructor(cliAvailable) {
      super();

      // Create the indicator icon
      this._indicator = this._addIndicator();
      this._indicator.visible = true;

      // Create the toggle button and sync indicator appearance with its state.
      this._toggle = new WarpToggle(cliAvailable, (appearance) => {
        this._indicator.iconName = appearance.iconName;
        this._indicator.visible = appearance.visible;
      });
      this.quickSettingsItems.push(this._toggle);
    }

    destroy() {
      this.quickSettingsItems.forEach((item) => item.destroy());
      super.destroy();
    }
  },
);

export default class WARPExtension extends Extension {
  enable() {
    const cliAvailable = Boolean(GLib.find_program_in_path(WARP_CLI));
    if (!cliAvailable) {
      console.error(WARP_CLI_NOT_FOUND);
      Main.notifyError(`${WARP_TITLE} Toggle`, WARP_CLI_NOT_FOUND);
    }

    // Add the indicator to the system panel
    this._indicator = new WarpIndicator(cliAvailable);
    Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
  }

  disable() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }
}
