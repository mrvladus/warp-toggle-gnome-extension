import GLib from 'gi://GLib';

import { isLoadingState } from '../lib/constants.js';
import {
  ANIMATION_FRAMES,
  ANIMATION_FRAME_INTERVAL_MS,
} from './stateAppearance.js';

/**
 * Reusable stateful icon animator.  Tracks a "static" icon name and can
 * cycle through ANIMATION_FRAMES on a target object's icon property.
 *
 * Callers use setStaticIcon() to declare the current icon for the state,
 * and start()/stop() to control animation.  On stop the static icon is
 * automatically restored — no manual bookkeeping needed by the caller.
 */
export class IconAnimator {
  constructor(target, iconProperty = 'iconName') {
    this._target = target;
    this._iconProp = iconProperty;
    this._timerId = null;
    this._frameIndex = 0;
    this._staticIcon = null;
  }

  get running() {
    return this._timerId !== null;
  }

  /**
   * Sets the static (non-animated) icon.  If no animation is running the
   * target is updated immediately; otherwise the value is stored and will
   * be applied when stop() is called.
   */
  setStaticIcon(iconName) {
    this._staticIcon = iconName;
    if (!this.running) {
      this._target[this._iconProp] = iconName;
    }
  }

  start() {
    if (this._timerId !== null) return;
    this._frameIndex = 0;
    const tick = () => {
      this._target[this._iconProp] = ANIMATION_FRAMES[this._frameIndex];
      this._frameIndex = (this._frameIndex + 1) % ANIMATION_FRAMES.length;
      return GLib.SOURCE_CONTINUE;
    };
    tick();
    this._timerId = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      ANIMATION_FRAME_INTERVAL_MS,
      tick,
    );
  }

  stop() {
    if (this._timerId !== null) {
      GLib.source_remove(this._timerId);
      this._timerId = null;
    }
    this._frameIndex = 0;
    if (this._staticIcon) {
      this._target[this._iconProp] = this._staticIcon;
    }
  }

  /**
   * Starts or stops animation based on the current state and preference.
   * Encapsulates the loading-state check so callers don't duplicate it.
   */
  syncToState(state, animationEnabled) {
    if (isLoadingState(state) && animationEnabled) {
      this.start();
    } else {
      this.stop();
    }
  }
}
