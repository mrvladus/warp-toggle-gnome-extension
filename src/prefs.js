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

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {
  ExtensionPreferences,
  gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { Settings, IndicatorStates } from './constants.js';

export default class WARPPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();

    // =====================================================================
    // Appearance page
    // =====================================================================
    const appearancePage = new Adw.PreferencesPage({
      title: _('Appearance'),
      iconName: 'preferences-desktop-appearance-symbolic',
    });
    window.add(appearancePage);

    // --- Account details group ---
    const accountGroup = new Adw.PreferencesGroup({
      title: _('Account Details'),
    });
    appearancePage.add(accountGroup);

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
    appearancePage.add(indicatorGroup);

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

    for (const { key, title } of Object.values(IndicatorStates)) {
      const row = new Adw.SwitchRow({
        title: _(title),
        active: settings.get_boolean(key),
      });
      stateExpanderRow.add_row(row);

      settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
    }

    // =====================================================================
    // Behaviour page
    // =====================================================================
    const behaviourPage = new Adw.PreferencesPage({
      title: _('Behaviour'),
      iconName: 'preferences-system-symbolic',
    });
    window.add(behaviourPage);

    // --- Polling group ---
    const pollingGroup = new Adw.PreferencesGroup({
      title: _('Status Polling'),
    });
    behaviourPage.add(pollingGroup);

    const pollIntervalRow = new Adw.SpinRow({
      title: _('Polling interval'),
      subtitle: _(
        'How often the extension checks the WARP connection status (seconds)',
      ),
      adjustment: new Gtk.Adjustment({
        value: settings.get_int(Settings.POLL_INTERVAL),
        lower: 1,
        upper: 3600,
        step_increment: 1,
        page_increment: 10,
      }),
    });
    pollingGroup.add(pollIntervalRow);

    // Use one-way GET bind (settings → widget) to avoid the bidirectional
    // bind writing back an uninitialised double value when GSettings fires
    // a changed notification (e.g. triggered by the extension restarting
    // its polling timer).  The widget → settings direction is handled
    // explicitly via notify::value.
    settings.bind(
      Settings.POLL_INTERVAL,
      pollIntervalRow,
      'value',
      Gio.SettingsBindFlags.GET,
    );
    pollIntervalRow.connect('notify::value', () => {
      settings.set_int(Settings.POLL_INTERVAL, pollIntervalRow.value);
    });

    // --- warp-cli group ---
    const warpCliGroup = new Adw.PreferencesGroup({
      title: _('warp-cli'),
    });
    behaviourPage.add(warpCliGroup);

    const useCustomCliRow = new Adw.SwitchRow({
      title: _('Use custom warp-cli path'),
      subtitle: _('Use a custom executable instead of the default warp-cli'),
      active: settings.get_boolean(Settings.USE_CUSTOM_WARP_CLI),
    });
    warpCliGroup.add(useCustomCliRow);

    settings.bind(
      Settings.USE_CUSTOM_WARP_CLI,
      useCustomCliRow,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    );

    const customCliPathRow = new Adw.EntryRow({
      title: _('Custom warp-cli path'),
      text: settings.get_string(Settings.CUSTOM_WARP_CLI_PATH),
      sensitive: settings.get_boolean(Settings.USE_CUSTOM_WARP_CLI),
    });
    warpCliGroup.add(customCliPathRow);

    settings.bind(
      Settings.CUSTOM_WARP_CLI_PATH,
      customCliPathRow,
      'text',
      Gio.SettingsBindFlags.DEFAULT,
    );

    // Enable/disable the path entry based on the toggle.
    settings.bind(
      Settings.USE_CUSTOM_WARP_CLI,
      customCliPathRow,
      'sensitive',
      Gio.SettingsBindFlags.GET,
    );
  }
}
