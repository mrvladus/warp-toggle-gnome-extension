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

// GSettings key names — single source of truth for both extension.js and prefs.js.
export const Settings = {
  SHOW_INDICATOR: 'show-indicator',
  SHOW_ACCOUNT_DETAILS: 'show-account-details',
  POLL_INTERVAL: 'poll-interval',
  USE_CUSTOM_WARP_CLI: 'use-custom-warp-cli',
  CUSTOM_WARP_CLI_PATH: 'custom-warp-cli-path',
};

// Per-state indicator settings keys and display metadata, keyed by state name.
// extension.js uses state keys to look up the GSettings key;
// prefs.js iterates values for `key` + `title`.
export const IndicatorStates = {
  connected: { key: 'indicator-connected', title: 'Connected' },
  connecting: { key: 'indicator-connecting', title: 'Connecting' },
  disconnected: { key: 'indicator-disconnected', title: 'Disconnected' },
  disabled: { key: 'indicator-disabled', title: 'Service not running' },
  no_route: { key: 'indicator-no-route', title: 'No route to host' },
  offline: { key: 'indicator-offline', title: 'Offline' },
  error: { key: 'indicator-error', title: 'Error' },
  not_registered: { key: 'indicator-not-registered', title: 'Not registered' },
};
