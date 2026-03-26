import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';

import {
  QuickMenuToggle,
  QuickToggle,
} from 'resource:///org/gnome/shell/ui/quickSettings.js';
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

class WarpQuickItemController {
  constructor(
    item,
    stateManager,
    settings,
    { extension = null, withMenu = false } = {},
  ) {
    this._item = item;
    this._stateManager = stateManager;
    this._settings = settings;
    this._extension = extension;
    this._withMenu = withMenu;
    this._animator = new IconAnimator(item);
    this._serviceMenu = null;

    if (this._withMenu) {
      this._buildMenu();
    }

    this._stateChangedId = this._stateManager.connect(
      'state-changed',
      (_mgr, state) => this._onStateChanged(state),
    );

    this._animationChangedId = this._settings.connect(
      `changed::${Settings.ENABLE_CONNECTING_ANIMATION}`,
      () => {
        this._animator.syncToState(
          this._stateManager.state,
          this._settings.get_boolean(Settings.ENABLE_CONNECTING_ANIMATION),
        );
      },
    );

    this._clickedId = this._item.connect('clicked', () => {
      const state = this._stateManager.state;
      if (isServiceTransitionState(state)) return;
      if (state === State.DISABLED) return;
      if (state === State.NOT_REGISTERED) {
        this._item.checked = false;
        Gio.AppInfo.launch_default_for_uri(URL_SETUP_GUIDE, null);
        return;
      }

      this._stateManager.toggleConnection(this._item.checked);
    });

    if (this._stateManager.state !== null) {
      this._onStateChanged(this._stateManager.state);
    }
  }

  _buildMenu() {
    this._item.menu.setHeader(ICON_DEFAULT, _(WARP_TITLE));

    if (
      this._settings.get_boolean(Settings.SHOW_QUICK_SETTINGS_SETTINGS_BUTTON)
    ) {
      const settingsButton = new St.Button({
        style_class: 'icon-button',
        child: new St.Icon({ iconName: 'emblem-system-symbolic' }),
        x_expand: true,
        x_align: Clutter.ActorAlign.END,
      });
      settingsButton.connect('clicked', () => {
        this._item.menu.close();
        if (this._extension) {
          this._extension.openPreferences();
        }
      });
      this._item.menu.addHeaderSuffix(settingsButton);
      this._item.menu._headerSpacer.x_expand = false;
    }

    this._serviceMenu = new ServiceMenuController(
      this._item.menu,
      this._stateManager,
    );
  }

  _onStateChanged(state) {
    const appearance = getStateAppearance(state);
    this._animator.setStaticIcon(appearance.iconName);

    this._item.toggleMode =
      state !== State.DISABLED && !isServiceTransitionState(state);
    this._item.checked = appearance.checked;
    this._item.subtitle =
      getStateSubtitle(state) ?? this._stateManager.providerSubtitle;

    if (this._serviceMenu) {
      this._item.set_reactive(true);
      this._serviceMenu.updateState(state);
    } else {
      this._item.set_reactive(
        state !== State.DISABLED && !isServiceTransitionState(state),
      );
    }

    this._animator.syncToState(
      state,
      this._settings.get_boolean(Settings.ENABLE_CONNECTING_ANIMATION),
    );
  }

  destroy() {
    this._animator.stop();
    if (this._clickedId) {
      this._item.disconnect(this._clickedId);
      this._clickedId = null;
    }
    if (this._stateChangedId) {
      this._stateManager.disconnect(this._stateChangedId);
      this._stateChangedId = null;
    }
    if (this._animationChangedId) {
      this._settings.disconnect(this._animationChangedId);
      this._animationChangedId = null;
    }
    if (this._serviceMenu) {
      this._serviceMenu.destroy();
      this._serviceMenu = null;
    }
  }
}

export const WarpMenuToggle = GObject.registerClass(
  class WarpMenuToggle extends QuickMenuToggle {
    constructor(stateManager, settings, extension) {
      super({
        title: _(WARP_TITLE),
        iconName: ICON_DEFAULT,
        toggleMode: true,
        checked: false,
      });

      this._controller = new WarpQuickItemController(
        this,
        stateManager,
        settings,
        { extension, withMenu: true },
      );
    }

    destroy() {
      if (this._controller) {
        this._controller.destroy();
        this._controller = null;
      }
      super.destroy();
    }
  },
);

export const WarpQuickButton = GObject.registerClass(
  class WarpQuickButton extends QuickToggle {
    constructor(stateManager, settings) {
      super({
        title: _(WARP_TITLE),
        iconName: ICON_DEFAULT,
        toggleMode: true,
        checked: false,
      });

      this._controller = new WarpQuickItemController(
        this,
        stateManager,
        settings,
        { withMenu: false },
      );
    }

    destroy() {
      if (this._controller) {
        this._controller.destroy();
        this._controller = null;
      }
      super.destroy();
    }
  },
);
