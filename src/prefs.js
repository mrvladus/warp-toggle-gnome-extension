import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {
  ExtensionPreferences,
  gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { Settings, IndicatorStates } from './lib/constants.js';
import { getWarpCli, runCommand } from './lib/warpCli.js';

const AUTHOR = 'mrvladus';
const LICENSE = 'GPL-3.0';
const LICENSE_URL = 'https://www.gnu.org/licenses/gpl-3.0.html';
const REPO_URL = 'https://github.com/mrvladus/warp-toggle-gnome-extension';
const ISSUES_URL = `${REPO_URL}/issues`;

const COMMAND_VERSION = '--version';
const COMMAND_REGISTRATION_SHOW = 'registration show';
const CLI_INFO_LOADING = 'Loading…';
const CLI_INFO_UNAVAILABLE = 'Unavailable';
const CLI_INFO_NOT_REGISTERED = 'Not registered';

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
    appearancePage.add(animationGroup);

    const animationRow = new Adw.SwitchRow({
      title: _('Connecting animation'),
      subtitle: _('Animate the toggle icon while WARP is connecting'),
      active: settings.get_boolean(Settings.ENABLE_CONNECTING_ANIMATION),
    });
    animationGroup.add(animationRow);

    settings.bind(
      Settings.ENABLE_CONNECTING_ANIMATION,
      animationRow,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    );

    // =====================================================================
    // WARP CLI page
    // =====================================================================
    const warpCliPage = new Adw.PreferencesPage({
      title: _('WARP CLI'),
      iconName: 'utilities-terminal-symbolic',
    });
    window.add(warpCliPage);

    // --- Polling group ---
    const pollingGroup = new Adw.PreferencesGroup({
      title: _('Status Polling'),
    });
    warpCliPage.add(pollingGroup);

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
    warpCliPage.add(warpCliGroup);

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

    // --- CLI Info group ---
    const cliInfoGroup = new Adw.PreferencesGroup({
      title: _('CLI Info'),
      description: _(
        'Details from the currently configured warp-cli executable',
      ),
    });
    warpCliPage.add(cliInfoGroup);

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
      description: _('Raw output from warp-cli registration show'),
    });
    warpCliPage.add(rawOutputGroup);

    const rawOutputLabel = new Gtk.Label({
      label: CLI_INFO_LOADING,
      selectable: true,
      wrap: true,
      xalign: 0,
      css_classes: ['monospace', 'dim-label'],
      margin_top: 8,
      margin_bottom: 8,
      margin_start: 12,
      margin_end: 12,
    });
    rawOutputGroup.add(rawOutputLabel);

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

        // Parse account type and detail
        const orgMatch = regOutput.match(/^organization:\s*(.+)/im);
        const emailMatch = regOutput.match(/^email:\s*(.+)/im);
        const accountMatch = regOutput.match(/^account name:\s*(.+)/im);

        if (orgMatch) {
          accountTypeRow.subtitle = _('Organization');
          accountDetailRow.title = _('Organization');
          accountDetailRow.subtitle = orgMatch[1].trim();
          accountDetailRow.visible = true;
        } else if (emailMatch) {
          accountTypeRow.subtitle = _('Personal');
          accountDetailRow.title = _('Email');
          accountDetailRow.subtitle = emailMatch[1].trim();
          accountDetailRow.visible = true;
        } else if (accountMatch) {
          accountTypeRow.subtitle = _('Personal');
          accountDetailRow.title = _('Account');
          accountDetailRow.subtitle = accountMatch[1].trim();
          accountDetailRow.visible = true;
        } else {
          accountTypeRow.subtitle = _('Personal');
          accountDetailRow.visible = false;
        }
      } catch (err) {
        const errMsg = `${err}`.toLowerCase();
        if (
          errMsg.includes('not registered') ||
          errMsg.includes('registration missing')
        ) {
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

    // =====================================================================
    // About page
    // =====================================================================
    const aboutPage = new Adw.PreferencesPage({
      title: _('About'),
      iconName: 'help-about-symbolic',
    });
    window.add(aboutPage);

    const { metadata } = this;

    // --- Header group (icon + name + version) ---
    const headerGroup = new Adw.PreferencesGroup();
    aboutPage.add(headerGroup);

    const headerBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      halign: Gtk.Align.FILL,
      spacing: 12,
      margin_top: 24,
      margin_bottom: 24,
    });

    // Extension icon — use Gtk.Picture so it scales to fill the window width
    const iconPath = `${this.path}/icon.svg`;
    const iconFile = Gio.File.new_for_path(iconPath);
    if (iconFile.query_exists(null)) {
      const iconPicture = new Gtk.Picture({
        file: iconFile,
        content_fit: Gtk.ContentFit.CONTAIN,
        hexpand: true,
        can_shrink: true,
      });
      iconPicture.add_css_class('icon-dropshadow');
      headerBox.append(iconPicture);
    }

    const nameLabel = new Gtk.Label({
      label: `<span size="x-large" weight="bold">${metadata.name}</span>`,
      use_markup: true,
      halign: Gtk.Align.CENTER,
    });
    headerBox.append(nameLabel);

    const versionPill = new Gtk.Label({
      label: _(`v${metadata.version}`),
      css_classes: ['caption'],
      halign: Gtk.Align.CENTER,
    });
    const provider = versionPill.get_style_context();
    provider.add_class('pill');
    const css = new Gtk.CssProvider();
    css.load_from_data(
      '.pill { background: alpha(@success_color, 0.15); color: @success_color; border-radius: 999px; padding: 4px 14px; font-weight: bold; }',
      -1,
    );
    versionPill
      .get_style_context()
      .add_provider(css, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    headerBox.append(versionPill);

    const descLabel = new Gtk.Label({
      label: _(metadata.description),
      css_classes: ['dim-label'],
      wrap: true,
      halign: Gtk.Align.CENTER,
      justify: Gtk.Justification.CENTER,
    });
    headerBox.append(descLabel);

    headerGroup.add(headerBox);

    // --- Links group ---
    const linksGroup = new Adw.PreferencesGroup();
    aboutPage.add(linksGroup);

    const repoRow = new Adw.ActionRow({
      title: _('GitHub Repository'),
      subtitle: REPO_URL,
      activatable: true,
    });
    repoRow.add_suffix(
      new Gtk.Image({ icon_name: 'adw-external-link-symbolic' }),
    );
    repoRow.connect('activated', () => {
      Gio.AppInfo.launch_default_for_uri(REPO_URL, null);
    });
    linksGroup.add(repoRow);

    const issuesRow = new Adw.ActionRow({
      title: _('Report an Issue'),
      subtitle: ISSUES_URL,
      activatable: true,
    });
    issuesRow.add_suffix(
      new Gtk.Image({ icon_name: 'adw-external-link-symbolic' }),
    );
    issuesRow.connect('activated', () => {
      Gio.AppInfo.launch_default_for_uri(ISSUES_URL, null);
    });
    linksGroup.add(issuesRow);

    // --- Credits group ---
    const creditsGroup = new Adw.PreferencesGroup({
      title: _('Credits'),
    });
    aboutPage.add(creditsGroup);

    const authorRow = new Adw.ActionRow({
      title: _('Created by'),
      subtitle: AUTHOR,
    });
    authorRow.add_prefix(
      new Gtk.Image({ icon_name: 'avatar-default-symbolic' }),
    );
    creditsGroup.add(authorRow);

    const licenseRow = new Adw.ActionRow({
      title: _('License'),
      subtitle: LICENSE,
      activatable: true,
    });
    licenseRow.add_prefix(
      new Gtk.Image({ icon_name: 'document-open-symbolic' }),
    );
    licenseRow.add_suffix(
      new Gtk.Image({ icon_name: 'adw-external-link-symbolic' }),
    );
    licenseRow.connect('activated', () => {
      Gio.AppInfo.launch_default_for_uri(LICENSE_URL, null);
    });
    creditsGroup.add(licenseRow);
  }
}
