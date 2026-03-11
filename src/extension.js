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

import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { WARP_CLI_DEFAULT, getWarpCli } from './lib/warpCli.js';
import { WarpIndicator } from './ui/indicator.js';
import { WARP_TITLE, ICON_DEFAULT } from './ui/quickToggle.js';

const WARP_CLI_NOT_FOUND = 'warp-cli command not found';

// debug flag
const DEBUG = false; // Boolean(GLib.getenv('WARP_CLI'));

export default class WARPExtension extends Extension {
  enable() {
    if (DEBUG) {
      console.log(`[WARP Toggle] CLI: ${WARP_CLI_DEFAULT}`);
      const source = new MessageTray.Source({
        title: WARP_TITLE,
        iconName: ICON_DEFAULT,
      });
      Main.messageTray.add(source);
      const notif = new MessageTray.Notification({
        source,
        title: `${WARP_TITLE} Toggle — debug`,
        body: `CLI: ${WARP_CLI_DEFAULT}`,
        isTransient: false,
      });
      source.addNotification(notif);
    }

    this._settings = this.getSettings();

    const warpCli = getWarpCli(this._settings);
    const cliAvailable = warpCli.includes('/')
      ? GLib.file_test(warpCli, GLib.FileTest.IS_EXECUTABLE)
      : Boolean(GLib.find_program_in_path(warpCli));
    if (!cliAvailable) {
      console.error(WARP_CLI_NOT_FOUND);
      Main.notifyError(
        `${WARP_TITLE} Toggle`,
        `${WARP_CLI_NOT_FOUND}: ${warpCli}`,
      );
    }

    // Add the indicator to the system panel
    this._indicator = new WarpIndicator(cliAvailable, this._settings);
    Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
  }

  disable() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }
}
