import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { Settings, IndicatorStates } from '../lib/warpTypes.js';

export function buildAppearancePage(settings) {
  const page = new Adw.PreferencesPage({
    title: _('Appearance'),
    iconName: 'preferences-desktop-appearance-symbolic',
  });

  // --- Account details group ---
  const accountGroup = new Adw.PreferencesGroup({
    title: _('Account Details'),
  });
  page.add(accountGroup);

  const accountDetailsRow = new Adw.SwitchRow({
    title: _('Show account details'),
    subtitle: _(
      'Display the registered account or organisation name in the toggle subtitle',
    ),
    active: settings.get_boolean(Settings.SHOW_ACCOUNT_DETAILS),
  });
  accountGroup.add(accountDetailsRow);

  settings.bind(
    Settings.SHOW_ACCOUNT_DETAILS,
    accountDetailsRow,
    'active',
    Gio.SettingsBindFlags.DEFAULT,
  );

  // --- Indicator group ---
  const indicatorGroup = new Adw.PreferencesGroup({
    title: _('Indicator'),
    description: _(
      'Control whether a status icon appears in the top bar for each connection state',
    ),
  });
  page.add(indicatorGroup);

  const indicatorRow = new Adw.SwitchRow({
    title: _('Show status indicator'),
    subtitle: _(
      'Show a status icon in the top bar alongside system indicators',
    ),
    active: settings.get_boolean(Settings.SHOW_INDICATOR),
  });
  indicatorGroup.add(indicatorRow);

  settings.bind(
    Settings.SHOW_INDICATOR,
    indicatorRow,
    'active',
    Gio.SettingsBindFlags.DEFAULT,
  );

  // Per-state indicator toggles inside an expander row

  const stateExpanderRow = new Adw.ExpanderRow({
    title: _('Per-state visibility'),
    subtitle: _('Choose which connection states show the indicator'),
    sensitive: settings.get_boolean(Settings.SHOW_INDICATOR),
  });
  indicatorGroup.add(stateExpanderRow);

  settings.bind(
    Settings.SHOW_INDICATOR,
    stateExpanderRow,
    'sensitive',
    Gio.SettingsBindFlags.GET,
  );

  for (const { key, title, iconName } of Object.values(IndicatorStates)) {
    const row = new Adw.SwitchRow({
      title: _(title),
      active: settings.get_boolean(key),
    });
    row.add_prefix(new Gtk.Image({ icon_name: iconName, pixel_size: 16 }));
    stateExpanderRow.add_row(row);

    settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
  }

  // --- Animation group ---
  const animationGroup = new Adw.PreferencesGroup({
    title: _('Animation'),
  });
  page.add(animationGroup);

  const animationRow = new Adw.SwitchRow({
    title: _('Toggle animation'),
    subtitle: _(
      'Animate the toggle icon during connecting and service operations',
    ),
    active: settings.get_boolean(Settings.ENABLE_CONNECTING_ANIMATION),
  });
  animationGroup.add(animationRow);

  settings.bind(
    Settings.ENABLE_CONNECTING_ANIMATION,
    animationRow,
    'active',
    Gio.SettingsBindFlags.DEFAULT,
  );

  return page;
}
