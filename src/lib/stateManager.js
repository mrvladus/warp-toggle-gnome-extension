import GObject from 'gi://GObject';
import GLib from 'gi://GLib';

import { Settings, State } from './constants.js';
import { runServiceCommand } from './serviceControl.js';
import {
  COMMAND_CONNECT,
  COMMAND_DISCONNECT,
  getWarpCli,
  runCommand,
  getVpnProvider,
  classifyWarpFailure,
  getWarpState,
  SUBTITLE_NOT_REGISTERED,
} from './warpCli.js';

const STATUS_CHECK_INTERVAL_SECONDS_DEFAULT = 10;

export const WarpStateManager = GObject.registerClass(
  {
    Signals: {
      'state-changed': { param_types: [GObject.TYPE_STRING] },
    },
  },
  class WarpStateManager extends GObject.Object {
    constructor(settings, cliAvailable) {
      super();

      this._settings = settings;
      this._cliAvailable = cliAvailable;
      this._state = null;
      this._providerSubtitle = null;
      this._warpCli = getWarpCli(settings);
      this._statusCheckId = null;
      this._pendingServiceAction = null;
      this._settingsIds = [];

      if (!this._cliAvailable) {
        this._setState(State.DISABLED);
        return;
      }

      // Fetch provider label immediately so it shows before the first poll.
      this._refreshProvider();

      this._setState(State.DISCONNECTED);
      this._updateStatus();
      this._startCheckingStatus();

      // Restart the polling timer whenever the interval setting changes.
      this._settingsIds.push(
        this._settings.connect(`changed::${Settings.POLL_INTERVAL}`, () => {
          this._stopCheckingStatus();
          this._startCheckingStatus();
        }),
      );

      // React to warp-cli path changes.
      this._settingsIds.push(
        this._settings.connect(`changed::${Settings.USE_CUSTOM_WARP_CLI}`, () =>
          this._onWarpCliChanged(),
        ),
      );
      this._settingsIds.push(
        this._settings.connect(
          `changed::${Settings.CUSTOM_WARP_CLI_PATH}`,
          () => this._onWarpCliChanged(),
        ),
      );

      // Show or clear account details when the preference toggles.
      this._settingsIds.push(
        this._settings.connect(
          `changed::${Settings.SHOW_ACCOUNT_DETAILS}`,
          () => this._refreshProvider(),
        ),
      );
    }

    get state() {
      return this._state;
    }

    get providerSubtitle() {
      return this._providerSubtitle;
    }

    // Emits the state-changed signal unconditionally.
    _notify(state) {
      this.emit('state-changed', state);
    }

    // Emits only when the state actually changes (for optimistic/transient updates).
    _setState(state) {
      if (this._state === state) {
        return;
      }
      this._state = state;
      this._notify(state);
    }

    async toggleConnection(checked) {
      const command = checked ? COMMAND_CONNECT : COMMAND_DISCONNECT;
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
    }

    async serviceAction(action) {
      const stateMap = {
        start: State.SERVICE_STARTING,
        stop: State.SERVICE_STOPPING,
        restart: State.SERVICE_RESTARTING,
      };
      this._pendingServiceAction = action;
      this._setState(stateMap[action]);

      try {
        await runServiceCommand(action, this._settings);
        // Let the existing periodic poll resolve the transition state.
        // _updateStatus() will ignore stale results while the action is pending.
      } catch (err) {
        this._pendingServiceAction = null;
        if (!err.cancelled) {
          this._setState(State.ERROR);
        } else {
          // pkexec cancelled — revert to real state.
          this._state = null;
          await this._updateStatus();
        }
      }
    }

    // Fetches fresh state and provider info; always notifies subscribers.
    async _updateStatus() {
      try {
        const [state, provider] = await Promise.all([
          getWarpState(this._warpCli),
          this._fetchProvider(),
        ]);

        // If a service action is pending, only accept "settled" results.
        if (this._pendingServiceAction) {
          const action = this._pendingServiceAction;
          const settled =
            action === 'stop'
              ? state === State.DISABLED
              : state !== State.DISABLED;
          if (!settled) {
            return;
          }
          this._pendingServiceAction = null;
        }

        if (provider === SUBTITLE_NOT_REGISTERED && state !== State.DISABLED) {
          this._providerSubtitle = null;
          this._state = State.NOT_REGISTERED;
        } else {
          this._providerSubtitle = provider;
          this._state = state;
        }

        // Always notify — provider may have changed even if state did not.
        this._notify(this._state);
      } catch (err) {
        if (this._pendingServiceAction) {
          return;
        }
        this._setState(classifyWarpFailure(err));
      }
    }

    // Fetches the provider subtitle if the preference is enabled.
    async _fetchProvider() {
      if (
        !this._settings ||
        !this._settings.get_boolean(Settings.SHOW_ACCOUNT_DETAILS)
      ) {
        return null;
      }
      try {
        return await getVpnProvider(this._warpCli);
      } catch {
        return this._providerSubtitle;
      }
    }

    // Refreshes the provider subtitle and re-notifies subscribers.
    async _refreshProvider() {
      this._providerSubtitle = await this._fetchProvider();
      if (this._state) {
        this._notify(this._state);
      }
    }

    _onWarpCliChanged() {
      this._warpCli = getWarpCli(this._settings);
      this._stopCheckingStatus();
      this._updateStatus();
      this._startCheckingStatus();
    }

    _startCheckingStatus() {
      if (this._statusCheckId) return;
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
      this._stopCheckingStatus();
      for (const id of this._settingsIds) {
        this._settings.disconnect(id);
      }
      this._settingsIds = [];
    }
  },
);
