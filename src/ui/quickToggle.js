import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { QuickToggle } from 'resource:///org/gnome/shell/ui/quickSettings.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import { Settings, State } from '../lib/constants.js';
import {
  COMMAND_CONNECT,
  COMMAND_DISCONNECT,
  SUBTITLE_NOT_REGISTERED,
  getWarpCli,
  runCommand,
  getVpnProvider,
  classifyWarpFailure,
  getWarpState,
} from '../lib/warpCli.js';

const STATUS_CHECK_INTERVAL_SECONDS_DEFAULT = 10;

// icons
const ICON_CONNECTED = 'network-vpn-symbolic';
const ICON_CONNECTING = 'network-vpn-acquiring-symbolic';
const ICON_DISCONNECTED = 'network-vpn-disconnected-symbolic';
const ICON_DISABLED = 'network-vpn-disabled-symbolic';
const ICON_NO_ROUTE = 'network-vpn-no-route-symbolic';
const ICON_OFFLINE = 'network-vpn-offline-symbolic';
const ICON_ERROR = 'network-vpn-error-symbolic';

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

export const WARP_TITLE = 'WARP';
export const ICON_DEFAULT = ICON_DISCONNECTED;

function getStateAppearance(state) {
  switch (state) {
    case State.CONNECTED:
      return { iconName: ICON_CONNECTED, checked: true, state };
    case State.CONNECTING:
      return { iconName: ICON_CONNECTING, checked: true, state };
    case State.DISCONNECTED:
      return { iconName: ICON_DISCONNECTED, checked: false, state };
    case State.DISABLED:
      return { iconName: ICON_DISABLED, checked: false, state };
    case State.NO_ROUTE:
      return { iconName: ICON_NO_ROUTE, checked: false, state };
    case State.OFFLINE:
      return { iconName: ICON_OFFLINE, checked: false, state };
    case State.NOT_REGISTERED:
      return { iconName: ICON_NO_ROUTE, checked: false, state };
    case State.ERROR:
    default:
      return { iconName: ICON_ERROR, checked: false, state: State.ERROR };
  }
}

function getStateSubtitle(state) {
  switch (state) {
    case State.CONNECTING:
      return SUBTITLE_CONNECTING;
    case State.DISABLED:
      return SUBTITLE_SERVICE_NOT_RUNNING;
    case State.NO_ROUTE:
      return SUBTITLE_NO_ROUTE;
    case State.OFFLINE:
      return SUBTITLE_OFFLINE;
    case State.NOT_REGISTERED:
      return SUBTITLE_NOT_REGISTERED;
    case State.ERROR:
      return SUBTITLE_ERROR;
    default:
      return null;
  }
}

export const WarpToggle = GObject.registerClass(
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
        this._setState(State.DISABLED);
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

      this._setState(State.DISCONNECTED);
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
          command === COMMAND_CONNECT ? State.CONNECTING : State.DISCONNECTED,
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
          this._onStateChange({ iconName, state: State.CONNECTING });
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
      if (state !== State.CONNECTING) {
        this.iconName = appearance.iconName;
      }
      this.checked = appearance.checked;
      // QuickToggle is a Clutter actor; `reactive` controls whether it accepts pointer input.
      this.reactive = state !== State.DISABLED;
      this._notRegistered = state === State.NOT_REGISTERED;
      // Error-like states show their own subtitle; normal states restore the provider label.
      this.subtitle = getStateSubtitle(state) ?? this._providerSubtitle;

      if (state === State.CONNECTING) {
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
        const showAccount = this._settings
          ? this._settings.get_boolean(Settings.SHOW_ACCOUNT_DETAILS)
          : true;
        const [state, provider] = await Promise.all([
          getWarpState(this._warpCli),
          showAccount ? getVpnProvider(this._warpCli) : Promise.resolve(null),
        ]);
        if (provider === SUBTITLE_NOT_REGISTERED && state !== State.DISABLED) {
          this._providerSubtitle = null;
          this._setState(State.NOT_REGISTERED);
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
