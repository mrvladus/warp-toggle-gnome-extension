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

import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

import {
  Extension,
  gettext as _,
} from 'resource:///org/gnome/shell/extensions/extension.js';
import {
  QuickToggle,
  SystemIndicator,
} from 'resource:///org/gnome/shell/ui/quickSettings.js';

import { Settings, IndicatorStates } from './constants.js';

const WARP_TITLE = 'WARP';
const STATUS_CHECK_INTERVAL_SECONDS_DEFAULT = 10;

// states
const STATE_CONNECTED = 'connected';
const STATE_CONNECTING = 'connecting';
const STATE_DISCONNECTED = 'disconnected';
const STATE_DISABLED = 'disabled';
const STATE_NO_ROUTE = 'no_route';
const STATE_OFFLINE = 'offline';
const STATE_ERROR = 'error';
const STATE_NOT_REGISTERED = 'not_registered';

// icons and states
const ICON_CONNECTED = 'network-vpn-symbolic';
const ICON_CONNECTING = 'network-vpn-acquiring-symbolic';
const ICON_DISCONNECTED = 'network-vpn-disconnected-symbolic';
const ICON_DISABLED = 'network-vpn-disabled-symbolic';
const ICON_NO_ROUTE = 'network-vpn-no-route-symbolic';
const ICON_OFFLINE = 'network-vpn-offline-symbolic';
const ICON_ERROR = 'network-vpn-error-symbolic';

const STATUS_CONNECTED = 'connected';
const STATUS_CONNECTING = 'connecting';
const STATUS_DISCONNECTED = 'disconnected';

// cli location and debug flag
const WARP_CLI_DEFAULT = GLib.getenv('WARP_CLI') || 'warp-cli';
const DEBUG = false; // Boolean(GLib.getenv('WARP_CLI'));

// command parameters
const COMMAND_STATUS = 'status';
const COMMAND_CONNECT = 'connect';
const COMMAND_DISCONNECT = 'disconnect';
const COMMAND_REGISTRATION_ORG = 'registration organization';
const COMMAND_REGISTRATION_SHOW = 'registration show';

// registration setup URL
const URL_SETUP_GUIDE =
  'https://developers.cloudflare.com/warp-client/get-started/linux/';

const ANIMATION_FRAMES = Array.from(
  { length: 14 },
  (_, i) => `nm-vpn-connecting${String(i + 1).padStart(2, '0')}-symbolic`,
);
const ANIMATION_FRAME_INTERVAL_MS = 100;

// subtitles
const SUBTITLE_CONNECTING = 'Connecting\u2026';
const SUBTITLE_SERVICE_NOT_RUNNING = 'Service not running';
const SUBTITLE_NO_ROUTE = 'No route to host';
const SUBTITLE_OFFLINE = 'Offline';
const SUBTITLE_ERROR = 'Unknown error';

const SUBTITLE_NOT_REGISTERED = 'Not registered \u00b7 Click to set up';

// Map each state to its per-state indicator settings key.
const STATE_INDICATOR_KEY = Object.fromEntries(
  Object.entries(IndicatorStates).map(([state, { key }]) => [state, key]),
);
const SUBTITLE_PREFIX_ORG = 'Org: ';
const SUBTITLE_PREFIX_PERSONAL = 'Acc: ';

// error strings
const WARP_CLI_NOT_FOUND = 'warp-cli command not found';

const DISABLED_ERROR_PATTERNS = [
  'no such file or directory',
  'failed to execute child process',
  'unable to connect',
  'daemon',
  'service not running',
];

const NO_ROUTE_ERROR_PATTERNS = [
  'network is unreachable',
  'no route to host',
  'could not resolve host',
  'name or service not known',
];

const OFFLINE_ERROR_PATTERNS = ['offline', 'timed out'];

function getStateAppearance(state) {
  switch (state) {
    case STATE_CONNECTED:
      return { iconName: ICON_CONNECTED, checked: true, state };
    case STATE_CONNECTING:
      return { iconName: ICON_CONNECTING, checked: true, state };
    case STATE_DISCONNECTED:
      return { iconName: ICON_DISCONNECTED, checked: false, state };
    case STATE_DISABLED:
      return { iconName: ICON_DISABLED, checked: false, state };
    case STATE_NO_ROUTE:
      return { iconName: ICON_NO_ROUTE, checked: false, state };
    case STATE_OFFLINE:
      return { iconName: ICON_OFFLINE, checked: false, state };
    case STATE_NOT_REGISTERED:
      return { iconName: ICON_NO_ROUTE, checked: false, state };
    case STATE_ERROR:
    default:
      return { iconName: ICON_ERROR, checked: false, state: STATE_ERROR };
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

function getWarpCli(settings) {
  if (
    settings &&
    settings.get_boolean(Settings.USE_CUSTOM_WARP_CLI) &&
    settings.get_string(Settings.CUSTOM_WARP_CLI_PATH)
  ) {
    return settings.get_string(Settings.CUSTOM_WARP_CLI_PATH);
  }
  return WARP_CLI_DEFAULT;
}

// Fetches the VPN provider label via `warp-cli registration organization`
// (Teams) or `registration show` (personal).
// Returns a prefixed string: "Organization: <name>" or "Personal: <name>",
// SUBTITLE_NOT_REGISTERED when no account is linked yet, or null when no
// identifiable info is available.
async function getVpnProvider(warpCli) {
  const isNotRegistered = (msg) =>
    msg.includes('not registered') || msg.includes('registration missing');

  try {
    const org = await runCommand(COMMAND_REGISTRATION_ORG, warpCli);
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
    const info = await runCommand(COMMAND_REGISTRATION_SHOW, warpCli);
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
async function runCommand(cmd, warpCli = WARP_CLI_DEFAULT) {
  return new Promise((resolve, reject) => {
    try {
      const proc = new Gio.Subprocess({
        argv: [warpCli, ...cmd.split(' ')],
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
          resolve(stdout ? stdout.trim() : '');
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
    constructor(cliAvailable, settings, onStateChange) {
      super({
        title: _(WARP_TITLE),
        iconName: ICON_DISCONNECTED,
        toggleMode: true,
        checked: false,
      });

      this._onStateChange = onStateChange;
      this._settings = settings;
      this._state = null;
      this._cliAvailable = cliAvailable;
      this._warpCli = getWarpCli(settings);
      this._statusCheckId = null; // Store timeout ID
      this._providerSubtitle = null; // Cached provider label
      this._animationTimerId = null;
      this._animationFrameIndex = 0;

      if (!this._cliAvailable) {
        this._setState(STATE_DISABLED);
        return;
      }

      // Fetch provider label immediately so it shows before the first status poll
      if (this._settings.get_boolean(Settings.SHOW_ACCOUNT_DETAILS)) {
        getVpnProvider(this._warpCli)
          .then((p) => {
            this._providerSubtitle = p;
            if (!getStateSubtitle(this._state)) {
              this.subtitle = p;
            }
          })
          .catch(() => {});
      }

      this._setState(STATE_DISCONNECTED);
      this._updateStatus(); // Initial check
      this._startCheckingStatus(); // Start periodic updates

      // Restart the polling timer whenever the interval setting changes.
      this._pollIntervalChangedId = this._settings.connect(
        `changed::${Settings.POLL_INTERVAL}`,
        () => {
          this._stopCheckingStatus();
          this._startCheckingStatus();
        },
      );

      // React to warp-cli path changes.
      this._warpCliChangedId = this._settings.connect(
        `changed::${Settings.USE_CUSTOM_WARP_CLI}`,
        () => this._onWarpCliChanged(),
      );
      this._warpCliPathChangedId = this._settings.connect(
        `changed::${Settings.CUSTOM_WARP_CLI_PATH}`,
        () => this._onWarpCliChanged(),
      );

      // Show or clear account details when the preference toggles.
      this._accountDetailsChangedId = this._settings.connect(
        `changed::${Settings.SHOW_ACCOUNT_DETAILS}`,
        () => {
          if (this._settings.get_boolean(Settings.SHOW_ACCOUNT_DETAILS)) {
            getVpnProvider(this._warpCli)
              .then((p) => {
                this._providerSubtitle = p;
                if (!getStateSubtitle(this._state)) {
                  this.subtitle = p;
                }
              })
              .catch(() => {});
          } else {
            this._providerSubtitle = null;
            if (!getStateSubtitle(this._state)) {
              this.subtitle = null;
            }
          }
        },
      );

      // Monitor button state changes
      this.connect('clicked', async () => {
        if (this._notRegistered) {
          Gio.AppInfo.launch_default_for_uri(URL_SETUP_GUIDE, null);
          return;
        }

        const command = this.checked ? COMMAND_CONNECT : COMMAND_DISCONNECT;
        this._setState(
          command === COMMAND_CONNECT ? STATE_CONNECTING : STATE_DISCONNECTED,
        );

        try {
          await runCommand(command, this._warpCli);
        } catch (err) {
          this._setState(classifyWarpFailure(err));
          return;
        }

        await this._updateStatus();
      });
    }

    _startConnectingAnimation() {
      if (this._animationTimerId !== null) return;
      this._animationFrameIndex = 0;
      const tick = () => {
        const iconName = ANIMATION_FRAMES[this._animationFrameIndex];
        this.iconName = iconName;
        if (this._onStateChange) {
          this._onStateChange({ iconName, state: STATE_CONNECTING });
        }
        this._animationFrameIndex =
          (this._animationFrameIndex + 1) % ANIMATION_FRAMES.length;
        return GLib.SOURCE_CONTINUE;
      };
      tick();
      this._animationTimerId = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        ANIMATION_FRAME_INTERVAL_MS,
        tick,
      );
    }

    _stopConnectingAnimation() {
      if (this._animationTimerId !== null) {
        GLib.source_remove(this._animationTimerId);
        this._animationTimerId = null;
      }
      this._animationFrameIndex = 0;
    }

    _setState(state) {
      if (this._state === state) {
        return;
      }

      this._stopConnectingAnimation();
      this._state = state;
      const appearance = getStateAppearance(state);
      if (state !== STATE_CONNECTING) {
        this.iconName = appearance.iconName;
      }
      this.checked = appearance.checked;
      // QuickToggle is a Clutter actor; `reactive` controls whether it accepts pointer input.
      this.reactive = state !== STATE_DISABLED;
      this._notRegistered = state === STATE_NOT_REGISTERED;
      // Error-like states show their own subtitle; normal states restore the provider label.
      this.subtitle = getStateSubtitle(state) ?? this._providerSubtitle;

      if (state === STATE_CONNECTING) {
        this._startConnectingAnimation();
      } else if (this._onStateChange) {
        this._onStateChange(appearance);
      }
    }

    _onWarpCliChanged() {
      this._warpCli = getWarpCli(this._settings);
      this._stopCheckingStatus();
      this._updateStatus();
      this._startCheckingStatus();
    }

    async _updateStatus() {
      try {
        // TODO: not ideal running Promise.all and the vpn provider here all the time
        const showAccount = this._settings
          ? this._settings.get_boolean(Settings.SHOW_ACCOUNT_DETAILS)
          : true;
        const [state, provider] = await Promise.all([
          this._getWarpState(),
          showAccount ? getVpnProvider(this._warpCli) : Promise.resolve(null),
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
      const interval = this._settings
        ? this._settings.get_int(Settings.POLL_INTERVAL)
        : STATUS_CHECK_INTERVAL_SECONDS_DEFAULT;
      this._statusCheckId = GLib.timeout_add_seconds(
        GLib.PRIORITY_DEFAULT,
        interval,
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

    async _getWarpState() {
      const status = await runCommand(COMMAND_STATUS, this._warpCli);
      return parseWarpStatus(status);
    }

    destroy() {
      this._stopConnectingAnimation();
      this._stopCheckingStatus();
      if (this._pollIntervalChangedId) {
        this._settings.disconnect(this._pollIntervalChangedId);
        this._pollIntervalChangedId = null;
      }
      if (this._accountDetailsChangedId) {
        this._settings.disconnect(this._accountDetailsChangedId);
        this._accountDetailsChangedId = null;
      }
      if (this._warpCliChangedId) {
        this._settings.disconnect(this._warpCliChangedId);
        this._warpCliChangedId = null;
      }
      if (this._warpCliPathChangedId) {
        this._settings.disconnect(this._warpCliPathChangedId);
        this._warpCliPathChangedId = null;
      }
      super.destroy();
    }
  },
);

const WarpIndicator = GObject.registerClass(
  class WarpIndicator extends SystemIndicator {
    constructor(cliAvailable, settings) {
      super();

      this._settings = settings;

      // Create the indicator icon; honour the show-indicator preference.
      this._indicator = this._addIndicator();
      this._indicator.visible = settings.get_boolean(Settings.SHOW_INDICATOR);

      this._indicatorSettingsIds = [];

      // Re-apply visibility whenever the main or any per-state toggle changes.
      const indicatorKeys = [
        Settings.SHOW_INDICATOR,
        ...Object.values(STATE_INDICATOR_KEY),
      ];
      for (const key of indicatorKeys) {
        const id = settings.connect(`changed::${key}`, () => {
          this._updateIndicatorVisibility(this._toggle?._state);
        });
        this._indicatorSettingsIds.push(id);
      }

      // Create the toggle button and sync indicator appearance with its state.
      this._toggle = new WarpToggle(cliAvailable, settings, (appearance) => {
        this._indicator.iconName = appearance.iconName;
        this._updateIndicatorVisibility(appearance.state);
      });
      this.quickSettingsItems.push(this._toggle);
    }

    _updateIndicatorVisibility(state) {
      if (!this._settings.get_boolean(Settings.SHOW_INDICATOR)) {
        this._indicator.visible = false;
        return;
      }
      const key = STATE_INDICATOR_KEY[state];
      this._indicator.visible = key ? this._settings.get_boolean(key) : true;
    }

    destroy() {
      for (const id of this._indicatorSettingsIds) {
        this._settings.disconnect(id);
      }
      this._indicatorSettingsIds = [];
      this.quickSettingsItems.forEach((item) => item.destroy());
      super.destroy();
    }
  },
);

export default class WARPExtension extends Extension {
  enable() {
    if (DEBUG) {
      console.log(`[WARP Toggle] CLI: ${WARP_CLI_DEFAULT}`);
      const source = new MessageTray.Source({
        title: WARP_TITLE,
        iconName: ICON_CONNECTED,
      });
      Main.messageTray.add(source);
      const notif = new MessageTray.Notification({
        source,
        title: `${WARP_TITLE} Toggle — debug`,
        body: `CLI: ${WARP_CLI_DEFAULT}`,
        isTransient: false,
      });
      source.addNotification(notif);
    }

    this._settings = this.getSettings();

    const warpCli = getWarpCli(this._settings);
    const cliAvailable = warpCli.includes('/')
      ? GLib.file_test(warpCli, GLib.FileTest.IS_EXECUTABLE)
      : Boolean(GLib.find_program_in_path(warpCli));
    if (!cliAvailable) {
      console.error(WARP_CLI_NOT_FOUND);
      Main.notifyError(
        `${WARP_TITLE} Toggle`,
        `${WARP_CLI_NOT_FOUND}: ${warpCli}`,
      );
    }

    // Add the indicator to the system panel
    this._indicator = new WarpIndicator(cliAvailable, this._settings);
    Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
  }

  disable() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }
}
