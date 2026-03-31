import { State, IndicatorStates } from '../lib/warpTypes.js';

export const ICON_DEFAULT = IndicatorStates[State.DISCONNECTED].iconName;
export const WARP_TITLE = 'WARP';

// animation
export const ANIMATION_FRAMES = Array.from(
  { length: 14 },
  (_, i) => `nm-vpn-connecting${String(i + 1).padStart(2, '0')}-symbolic`,
);
export const ANIMATION_FRAME_INTERVAL_MS = 100;

export function getStateAppearance(state) {
  const info = IndicatorStates[state];
  const iconName = info?.iconName ?? IndicatorStates[State.ERROR].iconName;
  const checked = state === State.CONNECTED || state === State.CONNECTING;
  return { iconName, checked, state: info ? state : State.ERROR };
}

export function getStateSubtitle(state) {
  return IndicatorStates[state]?.subtitle ?? null;
}
