import { State, IndicatorStates } from '../lib/constants.js';
import { SUBTITLE_NOT_REGISTERED } from '../lib/warpCli.js';

export const ICON_DEFAULT = IndicatorStates[State.DISCONNECTED].iconName;
export const WARP_TITLE = 'WARP';

// animation
export const ANIMATION_FRAMES = Array.from(
  { length: 14 },
  (_, i) => `nm-vpn-connecting${String(i + 1).padStart(2, '0')}-symbolic`,
);
export const ANIMATION_FRAME_INTERVAL_MS = 100;

// subtitles
const SUBTITLE_CONNECTING = 'Connecting\u2026';
const SUBTITLE_SERVICE_NOT_RUNNING = 'Service not running';
const SUBTITLE_NO_ROUTE = 'No route to host';
const SUBTITLE_OFFLINE = 'Offline';
const SUBTITLE_ERROR = 'Unknown error';

export function getStateAppearance(state) {
  const info = IndicatorStates[state];
  const iconName = info?.iconName ?? IndicatorStates[State.ERROR].iconName;
  const checked = state === State.CONNECTED || state === State.CONNECTING;
  return { iconName, checked, state: info ? state : State.ERROR };
}

export function getStateSubtitle(state) {
  switch (state) {
    case State.CONNECTING:
      return SUBTITLE_CONNECTING;
    case State.DISABLED:
      return SUBTITLE_SERVICE_NOT_RUNNING;
    case State.NO_ROUTE:
      return SUBTITLE_NO_ROUTE;
    case State.OFFLINE:
      return SUBTITLE_OFFLINE;
    case State.NOT_REGISTERED:
      return SUBTITLE_NOT_REGISTERED;
    case State.ERROR:
      return SUBTITLE_ERROR;
    default:
      return null;
  }
}
