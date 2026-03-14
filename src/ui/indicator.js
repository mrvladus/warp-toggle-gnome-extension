import GObject from 'gi://GObject';

import { SystemIndicator } from 'resource:///org/gnome/shell/ui/quickSettings.js';

import { Settings, IndicatorStates } from '../lib/constants.js';
import { getStateAppearance } from './stateAppearance.js';
import { IconAnimator } from './iconAnimator.js';

export const WarpIndicator = GObject.registerClass(
  class WarpIndicator extends SystemIndicator {
    constructor(stateManager, toggle, settings) {
      super();

      this._stateManager = stateManager;
      this._settings = settings;

      // Create the indicator icon; honour the show-indicator preference.
      this._indicator = this._addIndicator();
      this._animator = new IconAnimator(this._indicator);
      this._indicator.visible = settings.get_boolean(Settings.SHOW_INDICATOR);

      this._settingsIds = [];

      // Re-apply visibility whenever the main or any per-state toggle changes.
      const indicatorKeys = [
        Settings.SHOW_INDICATOR,
        ...new Set(Object.values(IndicatorStates).map((s) => s.key)),
      ];
      for (const key of indicatorKeys) {
        const id = settings.connect(`changed::${key}`, () => {
          this._updateIndicatorVisibility(this._stateManager.state);
        });
        this._settingsIds.push(id);
      }

      // Subscribe to state changes from the manager.
      this._stateChangedId = this._stateManager.connect(
        'state-changed',
        (_mgr, state) => this._onStateChanged(state),
      );

      this.quickSettingsItems.push(toggle);
    }

    _onStateChanged(state) {
      const appearance = getStateAppearance(state);
      this._animator.setStaticIcon(appearance.iconName);

      this._updateIndicatorVisibility(state);

      this._animator.syncToState(
        state,
        this._settings.get_boolean(Settings.ENABLE_CONNECTING_ANIMATION),
      );
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
      this._animator.stop();
      if (this._stateChangedId) {
        this._stateManager.disconnect(this._stateChangedId);
        this._stateChangedId = null;
      }
      for (const id of this._settingsIds) {
        this._settings.disconnect(id);
      }
      this._settingsIds = [];
      this.quickSettingsItems.forEach((item) => item.destroy());
      super.destroy();
    }
  },
);
