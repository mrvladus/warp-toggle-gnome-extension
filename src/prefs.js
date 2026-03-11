import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { buildAppearancePage } from './prefs/appearancePage.js';
import { buildWarpCliPage } from './prefs/warpCliPage.js';
import { buildAboutPage } from './prefs/aboutPage.js';

export default class WARPPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();
    window.add(buildAppearancePage(settings));
    window.add(buildWarpCliPage(settings));
    window.add(buildAboutPage(this));
  }
}
