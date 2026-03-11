import GObject from 'gi://GObject';

import { SystemIndicator } from 'resource:///org/gnome/shell/ui/quickSettings.js';

import { Settings, IndicatorStates } from '../lib/constants.js';
import { WarpToggle } from './quickToggle.js';

export const WarpIndicator = GObject.registerClass(
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
        ...Object.values(IndicatorStates).map((s) => s.key),
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
      const stateInfo = IndicatorStates[state];
      this._indicator.visible = stateInfo
        ? this._settings.get_boolean(stateInfo.key)
        : true;
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
