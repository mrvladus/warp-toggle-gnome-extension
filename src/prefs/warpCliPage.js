import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { Settings } from '../lib/constants.js';
import {
  getWarpCli,
  isRegistrationMissingError,
  parseRegistrationInfo,
  runCommand,
} from '../lib/warpCli.js';

const COMMAND_VERSION = '--version';
const COMMAND_REGISTRATION_SHOW = 'registration show';
const CLI_INFO_LOADING = 'Loading…';
const CLI_INFO_UNAVAILABLE = 'Unavailable';
const CLI_INFO_NOT_REGISTERED = 'Not registered';

export function buildWarpCliPage(settings) {
  const page = new Adw.PreferencesPage({
    title: _('Warp CLI'),
    iconName: 'utilities-terminal-symbolic',
  });

  // --- Polling group ---
  const pollingGroup = new Adw.PreferencesGroup({
    title: _('Status Polling'),
  });
  page.add(pollingGroup);

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
  page.add(warpCliGroup);

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

  // --- Service group ---
  const serviceGroup = new Adw.PreferencesGroup({
    title: _('Systemd Service'),
    description: _('Control the WARP daemon service managed via systemctl'),
  });
  page.add(serviceGroup);

  const useCustomServiceRow = new Adw.SwitchRow({
    title: _('Use custom service name'),
    subtitle: _(
      'Use a custom systemd unit instead of the default warp-svc.service',
    ),
    active: settings.get_boolean(Settings.USE_CUSTOM_SERVICE_NAME),
  });
  serviceGroup.add(useCustomServiceRow);

  settings.bind(
    Settings.USE_CUSTOM_SERVICE_NAME,
    useCustomServiceRow,
    'active',
    Gio.SettingsBindFlags.DEFAULT,
  );

  const serviceNameRow = new Adw.EntryRow({
    title: _('Custom service name'),
    text: settings.get_string(Settings.SERVICE_NAME),
    sensitive: settings.get_boolean(Settings.USE_CUSTOM_SERVICE_NAME),
  });
  serviceGroup.add(serviceNameRow);

  settings.bind(
    Settings.SERVICE_NAME,
    serviceNameRow,
    'text',
    Gio.SettingsBindFlags.DEFAULT,
  );

  // Enable/disable the service name entry based on the toggle.
  settings.bind(
    Settings.USE_CUSTOM_SERVICE_NAME,
    serviceNameRow,
    'sensitive',
    Gio.SettingsBindFlags.GET,
  );

  // --- CLI Info group ---
  const cliInfoGroup = new Adw.PreferencesGroup({
    title: _('CLI Info'),
    description: _('Details from the currently configured warp-cli executable'),
  });
  page.add(cliInfoGroup);

  const versionRow = new Adw.ActionRow({
    title: _('Version'),
    subtitle: CLI_INFO_LOADING,
  });
  versionRow.add_prefix(
    new Gtk.Image({ icon_name: 'application-x-executable-symbolic' }),
  );
  cliInfoGroup.add(versionRow);

  const accountTypeRow = new Adw.ActionRow({
    title: _('Account Type'),
    subtitle: CLI_INFO_LOADING,
  });
  accountTypeRow.add_prefix(
    new Gtk.Image({ icon_name: 'avatar-default-symbolic' }),
  );
  cliInfoGroup.add(accountTypeRow);

  const accountDetailRow = new Adw.ActionRow({
    title: _('Account'),
    subtitle: CLI_INFO_LOADING,
    visible: false,
  });
  accountDetailRow.add_prefix(
    new Gtk.Image({ icon_name: 'user-info-symbolic' }),
  );
  cliInfoGroup.add(accountDetailRow);

  // Raw output from `warp-cli registration show`
  const rawOutputGroup = new Adw.PreferencesGroup({
    title: _('Registration Details'),
    description: _('Details about the registration as reported by warp-cli'),
  });
  page.add(rawOutputGroup);

  const rawOutputLabel = new Gtk.Label({
    label: CLI_INFO_LOADING,
    selectable: true,
    wrap: false,
    xalign: 0,
    css_classes: ['monospace', 'dim-label'],
    margin_top: 8,
    margin_bottom: 8,
    margin_start: 12,
    margin_end: 12,
  });
  const rawOutputScroll = new Gtk.ScrolledWindow({
    hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
    vscrollbar_policy: Gtk.PolicyType.NEVER,
    hexpand: true,
  });
  rawOutputScroll.set_child(rawOutputLabel);
  rawOutputGroup.add(rawOutputScroll);

  // Refresh helper — fetches version and registration info
  const refreshCliInfo = async () => {
    const warpCli = getWarpCli(settings);

    // Fetch version
    try {
      const versionOutput = await runCommand(COMMAND_VERSION, warpCli);
      versionRow.subtitle = versionOutput || CLI_INFO_UNAVAILABLE;
    } catch (_e) {
      versionRow.subtitle = CLI_INFO_UNAVAILABLE;
    }

    // Fetch registration show
    try {
      const regOutput = await runCommand(COMMAND_REGISTRATION_SHOW, warpCli);
      rawOutputLabel.label = regOutput || CLI_INFO_UNAVAILABLE;

      const registrationInfo = parseRegistrationInfo(regOutput);

      if (registrationInfo.type === 'organization' && registrationInfo.detail) {
        accountTypeRow.subtitle = _('Organization');
        accountDetailRow.title = _('Organization');
        accountDetailRow.subtitle = registrationInfo.detail;
        accountDetailRow.visible = true;
      } else if (registrationInfo.detailType === 'email') {
        accountTypeRow.subtitle = _('Personal');
        accountDetailRow.title = _('Email');
        accountDetailRow.subtitle = registrationInfo.detail;
        accountDetailRow.visible = true;
      } else if (registrationInfo.detailType === 'account') {
        accountTypeRow.subtitle = _('Personal');
        accountDetailRow.title = _('Account');
        accountDetailRow.subtitle = registrationInfo.detail;
        accountDetailRow.visible = true;
      } else {
        accountTypeRow.subtitle = _('Personal');
        accountDetailRow.visible = false;
      }
    } catch (err) {
      if (isRegistrationMissingError(err)) {
        accountTypeRow.subtitle = CLI_INFO_NOT_REGISTERED;
        rawOutputLabel.label = CLI_INFO_NOT_REGISTERED;
      } else {
        accountTypeRow.subtitle = CLI_INFO_UNAVAILABLE;
        rawOutputLabel.label = CLI_INFO_UNAVAILABLE;
      }
      accountDetailRow.visible = false;
    }
  };

  // Initial fetch
  refreshCliInfo();

  // Re-fetch when CLI path settings change
  settings.connect(`changed::${Settings.USE_CUSTOM_WARP_CLI}`, () => {
    refreshCliInfo();
  });
  settings.connect(`changed::${Settings.CUSTOM_WARP_CLI_PATH}`, () => {
    refreshCliInfo();
  });

  return page;
}
