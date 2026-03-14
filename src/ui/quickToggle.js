import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';

import { QuickMenuToggle } from 'resource:///org/gnome/shell/ui/quickSettings.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import { Settings, State, isServiceTransitionState } from '../lib/constants.js';
import {
  ICON_DEFAULT,
  WARP_TITLE,
  getStateAppearance,
  getStateSubtitle,
} from './stateAppearance.js';
import { IconAnimator } from './iconAnimator.js';
import { ServiceMenuController } from './serviceMenu.js';

// registration setup URL
const URL_SETUP_GUIDE =
  'https://developers.cloudflare.com/warp-client/get-started/linux/';

export const WarpToggle = GObject.registerClass(
  class WarpToggle extends QuickMenuToggle {
    constructor(stateManager, settings, extension) {
      super({
        title: _(WARP_TITLE),
        iconName: ICON_DEFAULT,
        toggleMode: true,
        checked: false,
      });

      this._stateManager = stateManager;
      this._settings = settings;
      this._extension = extension;
      this._animator = new IconAnimator(this);

      // --- Build dropdown menu ---
      this._buildMenu();

      // Subscribe to state changes from the manager.
      this._stateChangedId = this._stateManager.connect(
        'state-changed',
        (_mgr, state) => this._onStateChanged(state),
      );

      // Toggle animation on/off when the preference changes.
      this._animationChangedId = this._settings.connect(
        `changed::${Settings.ENABLE_CONNECTING_ANIMATION}`,
        () => {
          this._animator.syncToState(
            this._stateManager.state,
            this._settings.get_boolean(Settings.ENABLE_CONNECTING_ANIMATION),
          );
        },
      );

      // Monitor button clicks — dispatch to state manager.
      this.connect('clicked', () => {
        const state = this._stateManager.state;
        if (isServiceTransitionState(state)) return;
        if (state === State.DISABLED) return;
        if (state === State.NOT_REGISTERED) {
          this.checked = false;
          Gio.AppInfo.launch_default_for_uri(URL_SETUP_GUIDE, null);
          return;
        }

        this._stateManager.toggleConnection(this.checked);
      });
    }

    _buildMenu() {
      // Header with settings button
      this.menu.setHeader(ICON_DEFAULT, _(WARP_TITLE));

      const settingsButton = new St.Button({
        style_class: 'icon-button',
        child: new St.Icon({ iconName: 'emblem-system-symbolic' }),
        x_expand: true,
        x_align: Clutter.ActorAlign.END,
      });
      settingsButton.connect('clicked', () => {
        this.menu.close();
        if (this._extension) {
          this._extension.openPreferences();
        }
      });
      this.menu.addHeaderSuffix(settingsButton);
      this.menu._headerSpacer.x_expand = false;

      // Service control items — encapsulated in a dedicated controller.
      this._serviceMenu = new ServiceMenuController(
        this.menu,
        this._stateManager,
      );
    }

    _onStateChanged(state) {
      const appearance = getStateAppearance(state);
      this._animator.setStaticIcon(appearance.iconName);

      this.toggleMode =
        state !== State.DISABLED && !isServiceTransitionState(state);
      this.checked = appearance.checked;
      this.subtitle =
        getStateSubtitle(state) ?? this._stateManager.providerSubtitle;

      this._serviceMenu.updateState(state);

      this._animator.syncToState(
        state,
        this._settings.get_boolean(Settings.ENABLE_CONNECTING_ANIMATION),
      );
    }

    destroy() {
      this._animator.stop();
      if (this._stateChangedId) {
        this._stateManager.disconnect(this._stateChangedId);
        this._stateChangedId = null;
      }
      if (this._animationChangedId) {
        this._settings.disconnect(this._animationChangedId);
        this._animationChangedId = null;
      }
      super.destroy();
    }
  },
);
