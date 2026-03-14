import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import { State, isServiceTransitionState } from '../lib/constants.js';

/**
 * Service Start/Stop toggle and Restart menu items.
 */
export class ServiceMenuController {
  constructor(menu, stateManager) {
    this._stateManager = stateManager;
    this._state = null;

    this._toggleItem = menu.addAction(_('Start Service'), () => {
      if (isServiceTransitionState(this._state)) return;
      const action = this._state === State.DISABLED ? 'start' : 'stop';
      this._stateManager.serviceAction(action);
    });
    this._restartItem = menu.addAction(_('Restart Service'), () => {
      if (isServiceTransitionState(this._state)) return;
      this._stateManager.serviceAction('restart');
    });

    // All items disabled until first state signal.
    this.updateState(null);
  }

  updateState(state) {
    this._state = state;

    // Restart is visible whenever the service is (or was) running.
    const serviceRunning = state !== null && state !== State.DISABLED;
    this._restartItem.visible = serviceRunning;

    if (isServiceTransitionState(state)) {
      const labelMap = {
        [State.SERVICE_STARTING]: _('Starting\u2026'),
        [State.SERVICE_STOPPING]: _('Stopping\u2026'),
        [State.SERVICE_RESTARTING]: _('Restarting\u2026'),
      };
      this._toggleItem.label.text = labelMap[state];
      this._toggleItem.setSensitive(false);
      this._restartItem.setSensitive(false);
      return;
    }

    this._toggleItem.label.text = serviceRunning
      ? _('Stop Service')
      : _('Start Service');
    this._toggleItem.setSensitive(state !== null);
    this._restartItem.setSensitive(serviceRunning);
  }

  destroy() {}
}
