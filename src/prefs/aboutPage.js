import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const AUTHOR = 'mrvladus';
const LICENSE = 'GPL-3.0';
const LICENSE_URL = 'https://www.gnu.org/licenses/gpl-3.0.html';
const REPO_URL = 'https://github.com/mrvladus/warp-toggle-gnome-extension';
const ISSUES_URL = `${REPO_URL}/issues`;
const CONTRIBUTORS = [
  {
    name: 'petar-v',
    url: 'https://github.com/petar-v',
  },
];

export function buildAboutPage(ext) {
  const page = new Adw.PreferencesPage({
    title: _('About'),
    iconName: 'help-about-symbolic',
  });

  const { metadata } = ext;

  // --- Header group (icon + name + version) ---
  const headerGroup = new Adw.PreferencesGroup();
  page.add(headerGroup);

  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    halign: Gtk.Align.FILL,
    spacing: 12,
    margin_top: 24,
    margin_bottom: 24,
  });

  // Extension icon — give Gtk.Picture an explicit size so it renders as a hero image
  const iconPath = `${ext.path}/icon.svg`;
  const iconFile = Gio.File.new_for_path(iconPath);
  if (iconFile.query_exists(null)) {
    const iconPicture = new Gtk.Picture({
      file: iconFile,
      content_fit: Gtk.ContentFit.CONTAIN,
      width_request: 160,
      height_request: 160,
      halign: Gtk.Align.CENTER,
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

  const descLabel = new Gtk.Label({
    label: _(metadata.description),
    css_classes: ['dim-label'],
    wrap: true,
    halign: Gtk.Align.CENTER,
    justify: Gtk.Justification.CENTER,
  });
  headerBox.append(descLabel);

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

  headerGroup.add(headerBox);

  // --- Links group ---
  const linksGroup = new Adw.PreferencesGroup();
  page.add(linksGroup);

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
  page.add(creditsGroup);

  const authorRow = new Adw.ActionRow({
    title: _('Created by'),
    subtitle: AUTHOR,
  });
  authorRow.add_prefix(new Gtk.Image({ icon_name: 'avatar-default-symbolic' }));
  creditsGroup.add(authorRow);

  const licenseRow = new Adw.ActionRow({
    title: _('License'),
    subtitle: LICENSE,
    activatable: true,
  });
  licenseRow.add_prefix(new Gtk.Image({ icon_name: 'document-open-symbolic' }));
  licenseRow.add_suffix(
    new Gtk.Image({ icon_name: 'adw-external-link-symbolic' }),
  );
  licenseRow.connect('activated', () => {
    Gio.AppInfo.launch_default_for_uri(LICENSE_URL, null);
  });
  creditsGroup.add(licenseRow);

  const contributorsGroup = new Adw.PreferencesGroup({
    title: _('Contributors'),
  });
  page.add(contributorsGroup);

  for (const contributor of CONTRIBUTORS) {
    const contributorRow = new Adw.ActionRow({
      title: contributor.name,
      subtitle: contributor.url,
      activatable: true,
    });
    contributorRow.add_prefix(
      new Gtk.Image({ icon_name: 'avatar-default-symbolic' }),
    );
    contributorRow.add_suffix(
      new Gtk.Image({ icon_name: 'adw-external-link-symbolic' }),
    );
    contributorRow.connect('activated', () => {
      Gio.AppInfo.launch_default_for_uri(contributor.url, null);
    });
    contributorsGroup.add(contributorRow);
  }

  return page;
}
