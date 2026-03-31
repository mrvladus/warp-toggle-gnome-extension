import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SYSTEMD_METHOD_MAP,
  messageContainsAny,
  isDbusAuthCancelled,
  isDbusAuthDenied,
} from '../src/lib/serviceControl/systemdDbusBackend.js';

// ---------------------------------------------------------------------------
// SYSTEMD_METHOD_MAP
// ---------------------------------------------------------------------------
describe('SYSTEMD_METHOD_MAP', () => {
  it('maps "start" to "StartUnit"', () => {
    assert.equal(SYSTEMD_METHOD_MAP.start, 'StartUnit');
  });

  it('maps "stop" to "StopUnit"', () => {
    assert.equal(SYSTEMD_METHOD_MAP.stop, 'StopUnit');
  });

  it('maps "restart" to "RestartUnit"', () => {
    assert.equal(SYSTEMD_METHOD_MAP.restart, 'RestartUnit');
  });

  it('returns undefined for unknown actions', () => {
    assert.equal(SYSTEMD_METHOD_MAP.reload, undefined);
    assert.equal(SYSTEMD_METHOD_MAP[''], undefined);
  });
});

// ---------------------------------------------------------------------------
// messageContainsAny
// ---------------------------------------------------------------------------
describe('messageContainsAny', () => {
  it('returns true when the message contains a marker', () => {
    assert.equal(
      messageContainsAny('Error: AccessDenied', ['accessdenied']),
      true,
    );
  });

  it('returns false when no markers match', () => {
    assert.equal(messageContainsAny('Success', ['error', 'fail']), false);
  });

  it('is case-insensitive', () => {
    assert.equal(
      messageContainsAny('USER DISMISSED prompt', ['dismissed']),
      true,
    );
  });

  it('matches any of multiple markers', () => {
    assert.equal(
      messageContainsAny('request was rejected by polkit', [
        'accessdenied',
        'rejected',
      ]),
      true,
    );
  });

  it('returns false for empty markers list', () => {
    assert.equal(messageContainsAny('some message', []), false);
  });

  it('returns false for empty message', () => {
    assert.equal(messageContainsAny('', ['error']), false);
  });
});

// ---------------------------------------------------------------------------
// isDbusAuthCancelled
// ---------------------------------------------------------------------------
describe('isDbusAuthCancelled', () => {
  it('detects "dismissed" marker', () => {
    assert.equal(isDbusAuthCancelled('The user dismissed the dialog'), true);
  });

  it('detects "NotAuthorized" marker (case-insensitive)', () => {
    assert.equal(isDbusAuthCancelled('GDBus.Error: NotAuthorized'), true);
  });

  it('detects "InteractiveAuthorizationRequired" marker', () => {
    assert.equal(
      isDbusAuthCancelled(
        'org.freedesktop.DBus.Error.InteractiveAuthorizationRequired',
      ),
      true,
    );
  });

  it('returns false for non-cancelled messages', () => {
    assert.equal(isDbusAuthCancelled('Connection timed out'), false);
  });

  it('returns false for denied messages', () => {
    assert.equal(isDbusAuthCancelled('AccessDenied by polkit'), false);
  });
});

// ---------------------------------------------------------------------------
// isDbusAuthDenied
// ---------------------------------------------------------------------------
describe('isDbusAuthDenied', () => {
  it('detects "AccessDenied" marker', () => {
    assert.equal(
      isDbusAuthDenied('org.freedesktop.DBus.Error.AccessDenied'),
      true,
    );
  });

  it('detects "rejected" marker', () => {
    assert.equal(isDbusAuthDenied('Authorization request was rejected'), true);
  });

  it('is case-insensitive', () => {
    assert.equal(isDbusAuthDenied('ACCESSDENIED'), true);
  });

  it('returns false for cancelled messages', () => {
    assert.equal(isDbusAuthDenied('User dismissed the prompt'), false);
  });

  it('returns false for generic errors', () => {
    assert.equal(isDbusAuthDenied('Connection failed'), false);
  });
});
