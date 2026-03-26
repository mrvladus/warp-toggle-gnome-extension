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
    description: _(
      'Control whether the quick settings tile shows its service menu',
    ),
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

  const headerGroup = new Adw.PreferencesGroup({
    title: _('Header Actions'),
    description: _('Control which shortcuts appear in the dropdown header'),
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
  headerGroup.add(settingsButtonRow);

  settings.bind(
    Settings.SHOW_QUICK_SETTINGS_SETTINGS_BUTTON,
    settingsButtonRow,
    'active',
    Gio.SettingsBindFlags.DEFAULT,
  );

  return page;
}
