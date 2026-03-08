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

    // Appearance group
    const appearanceGroup = new Adw.PreferencesGroup({
      title: _('Appearance'),
    });
    generalPage.add(appearanceGroup);

    const indicatorRow = new Adw.SwitchRow({
      title: _('Show status indicator'),
      subtitle: _(
        'Show a status icon in the top bar alongside system indicators',
      ),
      active: settings.get_boolean('show-indicator'),
    });
    appearanceGroup.add(indicatorRow);

    settings.bind(
      'show-indicator',
      indicatorRow,
      'active',
      Gio.SettingsBindFlags.GET,
    );
    indicatorRow.connect('notify::active', () => {
      settings.set_boolean('show-indicator', indicatorRow.active);
    });

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
