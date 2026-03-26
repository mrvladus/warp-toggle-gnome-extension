import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { Settings } from '../lib/constants.js';

export function buildQuickSettingsPage(settings) {
  const page = new Adw.PreferencesPage({
    title: _('Quick Settings'),
    iconName: 'view-grid-symbolic',
  });

  const group = new Adw.PreferencesGroup({
    title: _('Dropdown'),
  });
  page.add(group);

  const dropdownRow = new Adw.SwitchRow({
    title: _('Enable quick settings dropdown'),
    subtitle: _('Show the dropdown menu with service controls'),
    active: settings.get_boolean(Settings.ENABLE_QUICK_SETTINGS_DROPDOWN),
  });
  group.add(dropdownRow);

  settings.bind(
    Settings.ENABLE_QUICK_SETTINGS_DROPDOWN,
    dropdownRow,
    'active',
    Gio.SettingsBindFlags.DEFAULT,
  );

  const behaviorGroup = new Adw.PreferencesGroup({
    title: _('Tile Behavior'),
  });
  page.add(behaviorGroup);

  const startServiceOnDisabledClickRow = new Adw.SwitchRow({
    title: _('Start service when disabled tile is clicked'),
    subtitle: _(
      'Make a click on the disabled quick settings tile start the systemd service directly',
    ),
    active: settings.get_boolean(Settings.START_SERVICE_ON_DISABLED_CLICK),
  });
  behaviorGroup.add(startServiceOnDisabledClickRow);

  settings.bind(
    Settings.START_SERVICE_ON_DISABLED_CLICK,
    startServiceOnDisabledClickRow,
    'active',
    Gio.SettingsBindFlags.DEFAULT,
  );

  const headerGroup = new Adw.PreferencesGroup({
    title: _('Header Actions'),
    sensitive: settings.get_boolean(Settings.ENABLE_QUICK_SETTINGS_DROPDOWN),
  });
  page.add(headerGroup);

  settings.bind(
    Settings.ENABLE_QUICK_SETTINGS_DROPDOWN,
    headerGroup,
    'sensitive',
    Gio.SettingsBindFlags.GET,
  );

  const settingsButtonRow = new Adw.SwitchRow({
    title: _('Show settings button'),
    subtitle: _(
      'Add a shortcut button in the dropdown header that opens the extension preferences',
    ),
    active: settings.get_boolean(Settings.SHOW_QUICK_SETTINGS_SETTINGS_BUTTON),
  });
  const refreshButtonRow = new Adw.SwitchRow({
    title: _('Show refresh button'),
    subtitle: _(
      'Add a shortcut button in the dropdown header that refreshes the service status immediately',
    ),
    active: settings.get_boolean(Settings.SHOW_QUICK_SETTINGS_REFRESH_BUTTON),
  });
  headerGroup.add(refreshButtonRow);
  headerGroup.add(settingsButtonRow);

  settings.bind(
    Settings.SHOW_QUICK_SETTINGS_REFRESH_BUTTON,
    refreshButtonRow,
    'active',
    Gio.SettingsBindFlags.DEFAULT,
  );

  settings.bind(
    Settings.SHOW_QUICK_SETTINGS_SETTINGS_BUTTON,
    settingsButtonRow,
    'active',
    Gio.SettingsBindFlags.DEFAULT,
  );

  return page;
}
