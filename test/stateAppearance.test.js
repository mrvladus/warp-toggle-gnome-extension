import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getStateAppearance,
  getStateSubtitle,
  ICON_DEFAULT,
  WARP_TITLE,
  ANIMATION_FRAMES,
  ANIMATION_FRAME_INTERVAL_MS,
} from '../src/ui/stateAppearance.js';
import { State, IndicatorStates } from '../src/lib/warpTypes.js';

// ---------------------------------------------------------------------------
// getStateAppearance
// ---------------------------------------------------------------------------
describe('getStateAppearance', () => {
  it('returns correct appearance for CONNECTED', () => {
    const result = getStateAppearance(State.CONNECTED);
    assert.equal(result.iconName, IndicatorStates.connected.iconName);
    assert.equal(result.checked, true);
    assert.equal(result.state, State.CONNECTED);
  });

  it('returns correct appearance for CONNECTING', () => {
    const result = getStateAppearance(State.CONNECTING);
    assert.equal(result.iconName, IndicatorStates.connecting.iconName);
    assert.equal(result.checked, true);
    assert.equal(result.state, State.CONNECTING);
  });

  it('returns checked=false for DISCONNECTED', () => {
    const result = getStateAppearance(State.DISCONNECTED);
    assert.equal(result.checked, false);
    assert.equal(result.state, State.DISCONNECTED);
  });

  it('returns checked=false for ERROR', () => {
    const result = getStateAppearance(State.ERROR);
    assert.equal(result.checked, false);
  });

  it('returns checked=false for all non-connected/connecting states', () => {
    const uncheckedStates = [
      State.DISCONNECTED,
      State.DISABLED,
      State.NO_ROUTE,
      State.OFFLINE,
      State.ERROR,
      State.NOT_REGISTERED,
      State.SERVICE_STARTING,
      State.SERVICE_STOPPING,
      State.SERVICE_RESTARTING,
    ];
    for (const state of uncheckedStates) {
      const result = getStateAppearance(state);
      assert.equal(result.checked, false, `${state} should not be checked`);
    }
  });

  it('falls back to ERROR icon for unknown states', () => {
    const result = getStateAppearance('nonexistent_state');
    assert.equal(result.iconName, IndicatorStates.error.iconName);
    assert.equal(result.state, State.ERROR);
  });

  it('returns correct icon for every known state', () => {
    for (const state of Object.values(State)) {
      const result = getStateAppearance(state);
      assert.equal(result.iconName, IndicatorStates[state].iconName);
    }
  });
});

// ---------------------------------------------------------------------------
// getStateSubtitle
// ---------------------------------------------------------------------------
describe('getStateSubtitle', () => {
  it('returns null for CONNECTED', () => {
    assert.equal(getStateSubtitle(State.CONNECTED), null);
  });

  it('returns null for DISCONNECTED', () => {
    assert.equal(getStateSubtitle(State.DISCONNECTED), null);
  });

  it('returns subtitle for CONNECTING', () => {
    assert.equal(
      getStateSubtitle(State.CONNECTING),
      IndicatorStates.connecting.subtitle,
    );
  });

  it('returns subtitle for DISABLED', () => {
    assert.equal(
      getStateSubtitle(State.DISABLED),
      IndicatorStates.disabled.subtitle,
    );
  });

  it('returns subtitle for ERROR', () => {
    assert.equal(getStateSubtitle(State.ERROR), IndicatorStates.error.subtitle);
  });

  it('returns null for unknown states', () => {
    assert.equal(getStateSubtitle('nonexistent_state'), null);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe('stateAppearance constants', () => {
  it('ICON_DEFAULT is the disconnected icon', () => {
    assert.equal(ICON_DEFAULT, IndicatorStates.disconnected.iconName);
  });

  it('WARP_TITLE is "WARP"', () => {
    assert.equal(WARP_TITLE, 'WARP');
  });

  it('ANIMATION_FRAMES has 14 frames', () => {
    assert.equal(ANIMATION_FRAMES.length, 14);
  });

  it('ANIMATION_FRAMES are zero-padded sequential icon names', () => {
    assert.equal(ANIMATION_FRAMES[0], 'nm-vpn-connecting01-symbolic');
    assert.equal(ANIMATION_FRAMES[13], 'nm-vpn-connecting14-symbolic');
  });

  it('ANIMATION_FRAME_INTERVAL_MS is a positive number', () => {
    assert.ok(ANIMATION_FRAME_INTERVAL_MS > 0);
  });
});
