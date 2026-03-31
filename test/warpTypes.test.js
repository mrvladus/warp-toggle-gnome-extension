import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  State,
  IndicatorStates,
  isServiceTransitionState,
  isLoadingState,
} from '../src/lib/warpTypes.js';

// ---------------------------------------------------------------------------
// isServiceTransitionState
// ---------------------------------------------------------------------------
describe('isServiceTransitionState', () => {
  it('returns true for SERVICE_STARTING', () => {
    assert.ok(isServiceTransitionState(State.SERVICE_STARTING));
  });

  it('returns true for SERVICE_STOPPING', () => {
    assert.ok(isServiceTransitionState(State.SERVICE_STOPPING));
  });

  it('returns true for SERVICE_RESTARTING', () => {
    assert.ok(isServiceTransitionState(State.SERVICE_RESTARTING));
  });

  it('returns false for non-transition states', () => {
    assert.ok(!isServiceTransitionState(State.CONNECTED));
    assert.ok(!isServiceTransitionState(State.DISCONNECTED));
    assert.ok(!isServiceTransitionState(State.CONNECTING));
    assert.ok(!isServiceTransitionState(State.ERROR));
    assert.ok(!isServiceTransitionState(State.DISABLED));
  });
});

// ---------------------------------------------------------------------------
// isLoadingState
// ---------------------------------------------------------------------------
describe('isLoadingState', () => {
  it('returns true for CONNECTING', () => {
    assert.ok(isLoadingState(State.CONNECTING));
  });

  it('returns true for all service transition states', () => {
    assert.ok(isLoadingState(State.SERVICE_STARTING));
    assert.ok(isLoadingState(State.SERVICE_STOPPING));
    assert.ok(isLoadingState(State.SERVICE_RESTARTING));
  });

  it('returns false for non-loading states', () => {
    assert.ok(!isLoadingState(State.CONNECTED));
    assert.ok(!isLoadingState(State.DISCONNECTED));
    assert.ok(!isLoadingState(State.ERROR));
    assert.ok(!isLoadingState(State.DISABLED));
    assert.ok(!isLoadingState(State.NO_ROUTE));
    assert.ok(!isLoadingState(State.OFFLINE));
  });
});

// ---------------------------------------------------------------------------
// IndicatorStates completeness
// ---------------------------------------------------------------------------
describe('IndicatorStates', () => {
  it('has an entry for every State value', () => {
    for (const state of Object.values(State)) {
      assert.ok(
        IndicatorStates[state],
        `Missing IndicatorStates entry for State.${state}`,
      );
    }
  });

  it('every entry has required properties', () => {
    for (const [state, info] of Object.entries(IndicatorStates)) {
      assert.ok(info.key, `${state} missing key`);
      assert.ok(info.title, `${state} missing title`);
      assert.ok(info.iconName, `${state} missing iconName`);
      // subtitle may be null for connected/disconnected
      assert.ok('subtitle' in info, `${state} missing subtitle property`);
    }
  });
});
