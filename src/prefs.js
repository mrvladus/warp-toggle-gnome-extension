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

export default class WARPPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();

    // --- General page ---
    const generalPage = new Adw.PreferencesPage({
      title: _('General'),
      iconName: 'preferences-system-symbolic',
    });
    window.add(generalPage);

    // Indicator group
    const indicatorGroup = new Adw.PreferencesGroup({
      title: _('Indicator'),
    });
    generalPage.add(indicatorGroup);

    const indicatorRow = new Adw.SwitchRow({
      title: _('Show status indicator'),
      subtitle: _(
        'Show a status icon in the top bar alongside system indicators',
      ),
      active: settings.get_boolean('show-indicator'),
    });
    indicatorGroup.add(indicatorRow);

    settings.bind(
      'show-indicator',
      indicatorRow,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    );

    // Per-state indicator toggles
    const stateIndicators = [
      { key: 'indicator-connected', title: _('Connected') },
      { key: 'indicator-connecting', title: _('Connecting') },
      { key: 'indicator-disconnected', title: _('Disconnected') },
      { key: 'indicator-disabled', title: _('Service not running') },
      { key: 'indicator-no-route', title: _('No route to host') },
      { key: 'indicator-offline', title: _('Offline') },
      { key: 'indicator-error', title: _('Error') },
      { key: 'indicator-not-registered', title: _('Not registered') },
    ];

    for (const { key, title } of stateIndicators) {
      const row = new Adw.SwitchRow({
        title,
        active: settings.get_boolean(key),
        sensitive: settings.get_boolean('show-indicator'),
      });
      indicatorGroup.add(row);

      settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
      settings.bind(
        'show-indicator',
        row,
        'sensitive',
        Gio.SettingsBindFlags.GET,
      );
    }

    // Appearance group
    const appearanceGroup = new Adw.PreferencesGroup({
      title: _('Appearance'),
    });
    generalPage.add(appearanceGroup);

    const accountDetailsRow = new Adw.SwitchRow({
      title: _('Show account details'),
      subtitle: _(
        'Display the registered account or organisation name in the toggle subtitle',
      ),
      active: settings.get_boolean('show-account-details'),
    });
    appearanceGroup.add(accountDetailsRow);

    settings.bind(
      'show-account-details',
      accountDetailsRow,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    );

    // warp-cli group
    const warpCliGroup = new Adw.PreferencesGroup({
      title: _('warp-cli'),
    });
    generalPage.add(warpCliGroup);

    const useCustomCliRow = new Adw.SwitchRow({
      title: _('Use custom warp-cli path'),
      subtitle: _('Use a custom executable instead of the default warp-cli'),
      active: settings.get_boolean('use-custom-warp-cli'),
    });
    warpCliGroup.add(useCustomCliRow);

    settings.bind(
      'use-custom-warp-cli',
      useCustomCliRow,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    );

    const customCliPathRow = new Adw.EntryRow({
      title: _('Custom warp-cli path'),
      text: settings.get_string('custom-warp-cli-path'),
      sensitive: settings.get_boolean('use-custom-warp-cli'),
    });
    warpCliGroup.add(customCliPathRow);

    settings.bind(
      'custom-warp-cli-path',
      customCliPathRow,
      'text',
      Gio.SettingsBindFlags.DEFAULT,
    );

    // Enable/disable the path entry based on the toggle.
    settings.bind(
      'use-custom-warp-cli',
      customCliPathRow,
      'sensitive',
      Gio.SettingsBindFlags.GET,
    );

    // Behaviour group
    const behaviourGroup = new Adw.PreferencesGroup({
      title: _('Behaviour'),
    });
    generalPage.add(behaviourGroup);

    const pollIntervalRow = new Adw.SpinRow({
      title: _('Polling interval'),
      subtitle: _(
        'How often the extension checks the WARP connection status (seconds)',
      ),
      adjustment: new Gtk.Adjustment({
        value: settings.get_int('poll-interval'),
        lower: 1,
        upper: 3600,
        step_increment: 1,
        page_increment: 10,
      }),
    });
    behaviourGroup.add(pollIntervalRow);

    // Use one-way GET bind (settings → widget) to avoid the bidirectional
    // bind writing back an uninitialised double value when GSettings fires
    // a changed notification (e.g. triggered by the extension restarting
    // its polling timer).  The widget → settings direction is handled
    // explicitly via notify::value.
    settings.bind(
      'poll-interval',
      pollIntervalRow,
      'value',
      Gio.SettingsBindFlags.GET,
    );
    pollIntervalRow.connect('notify::value', () => {
      settings.set_int('poll-interval', pollIntervalRow.value);
    });
  }
}
