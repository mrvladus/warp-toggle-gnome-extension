import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseWarpStatus,
  classifyWarpFailure,
  parseRegistrationInfo,
  isRegistrationMissingError,
  getWarpCli,
  WARP_CLI_DEFAULT,
} from '../src/lib/warpCli.js';
import { State } from '../src/lib/warpTypes.js';

// ---------------------------------------------------------------------------
// parseWarpStatus
// ---------------------------------------------------------------------------
describe('parseWarpStatus', () => {
  it('returns CONNECTED for "Status: Connected"', () => {
    assert.equal(parseWarpStatus('Status update: Connected'), State.CONNECTED);
  });

  it('returns DISCONNECTED for "Status: Disconnected"', () => {
    assert.equal(
      parseWarpStatus('Status update: Disconnected'),
      State.DISCONNECTED,
    );
  });

  it('returns CONNECTING for "Status: Connecting"', () => {
    assert.equal(
      parseWarpStatus('Status update: Connecting'),
      State.CONNECTING,
    );
  });

  it('returns DISCONNECTED (not CONNECTED) when output contains "disconnected"', () => {
    // "disconnected" contains the substring "connected" — order matters
    assert.equal(parseWarpStatus('disconnected'), State.DISCONNECTED);
  });

  it('is case-insensitive', () => {
    assert.equal(parseWarpStatus('STATUS: CONNECTED'), State.CONNECTED);
    assert.equal(parseWarpStatus('status: disconnected'), State.DISCONNECTED);
  });

  it('returns DISABLED for daemon-related errors', () => {
    assert.equal(
      parseWarpStatus('Unable to connect to CloudflareWARP daemon'),
      State.DISABLED,
    );
    assert.equal(parseWarpStatus('Service not running'), State.DISABLED);
  });

  it('returns NO_ROUTE for network-unreachable errors', () => {
    assert.equal(parseWarpStatus('Network is unreachable'), State.NO_ROUTE);
    assert.equal(parseWarpStatus('No route to host'), State.NO_ROUTE);
    assert.equal(parseWarpStatus('Could not resolve host'), State.NO_ROUTE);
  });

  it('returns OFFLINE for offline/timeout errors', () => {
    assert.equal(parseWarpStatus('offline'), State.OFFLINE);
    assert.equal(parseWarpStatus('request timed out'), State.OFFLINE);
  });

  it('returns ERROR for null/undefined/empty input', () => {
    assert.equal(parseWarpStatus(null), State.ERROR);
    assert.equal(parseWarpStatus(undefined), State.ERROR);
    assert.equal(parseWarpStatus(''), State.ERROR);
  });

  it('returns ERROR for unrecognized output', () => {
    assert.equal(parseWarpStatus('something unexpected'), State.ERROR);
  });
});

// ---------------------------------------------------------------------------
// classifyWarpFailure
// ---------------------------------------------------------------------------
describe('classifyWarpFailure', () => {
  it('returns DISABLED for "no such file or directory"', () => {
    assert.equal(
      classifyWarpFailure(new Error('No such file or directory')),
      State.DISABLED,
    );
  });

  it('returns DISABLED for "failed to execute child process"', () => {
    assert.equal(
      classifyWarpFailure('Failed to execute child process'),
      State.DISABLED,
    );
  });

  it('returns DISABLED for "unable to connect"', () => {
    assert.equal(
      classifyWarpFailure(new Error('Unable to connect to daemon')),
      State.DISABLED,
    );
  });

  it('returns NO_ROUTE for "name or service not known"', () => {
    assert.equal(
      classifyWarpFailure(new Error('Name or service not known')),
      State.NO_ROUTE,
    );
  });

  it('returns OFFLINE for "timed out"', () => {
    assert.equal(
      classifyWarpFailure(new Error('Connection timed out')),
      State.OFFLINE,
    );
  });

  it('returns ERROR for unknown errors', () => {
    assert.equal(
      classifyWarpFailure(new Error('something weird')),
      State.ERROR,
    );
  });

  it('handles non-Error values (strings)', () => {
    assert.equal(classifyWarpFailure('daemon error'), State.DISABLED);
  });
});

// ---------------------------------------------------------------------------
// parseRegistrationInfo
// ---------------------------------------------------------------------------
describe('parseRegistrationInfo', () => {
  it('extracts organization name', () => {
    const result = parseRegistrationInfo('Organization: Acme Corp');
    assert.deepEqual(result, {
      type: 'organization',
      detailType: 'organization',
      detail: 'Acme Corp',
    });
  });

  it('extracts email for personal accounts', () => {
    const result = parseRegistrationInfo('Email: user@example.com');
    assert.deepEqual(result, {
      type: 'personal',
      detailType: 'email',
      detail: 'user@example.com',
    });
  });

  it('extracts account name for personal accounts', () => {
    const result = parseRegistrationInfo('Account Name: John Doe');
    assert.deepEqual(result, {
      type: 'personal',
      detailType: 'account',
      detail: 'John Doe',
    });
  });

  it('prefers organization over email when both present', () => {
    const result = parseRegistrationInfo(
      'Organization: Acme Corp\nEmail: user@example.com',
    );
    assert.equal(result.type, 'organization');
    assert.equal(result.detail, 'Acme Corp');
  });

  it('returns default personal with null detail for unrecognized output', () => {
    const result = parseRegistrationInfo('some random text');
    assert.deepEqual(result, {
      type: 'personal',
      detailType: null,
      detail: null,
    });
  });

  it('trims whitespace from matched values', () => {
    const result = parseRegistrationInfo('Email:   user@example.com   ');
    assert.equal(result.detail, 'user@example.com');
  });

  it('is case-insensitive for field names', () => {
    const result = parseRegistrationInfo('email: user@example.com');
    assert.equal(result.detailType, 'email');
    assert.equal(result.detail, 'user@example.com');
  });

  it('handles multiline output', () => {
    const output = [
      'Account ID: abc123',
      'Account Name: Test User',
      'Device ID: xyz789',
    ].join('\n');
    const result = parseRegistrationInfo(output);
    assert.equal(result.detailType, 'account');
    assert.equal(result.detail, 'Test User');
  });
});

// ---------------------------------------------------------------------------
// isRegistrationMissingError
// ---------------------------------------------------------------------------
describe('isRegistrationMissingError', () => {
  it('returns true for "not registered" messages', () => {
    assert.ok(isRegistrationMissingError('Not registered'));
    assert.ok(isRegistrationMissingError('Device is not registered'));
  });

  it('returns true for "registration missing" messages', () => {
    assert.ok(isRegistrationMissingError('Registration missing'));
  });

  it('is case-insensitive', () => {
    assert.ok(isRegistrationMissingError('NOT REGISTERED'));
    assert.ok(isRegistrationMissingError('REGISTRATION MISSING'));
  });

  it('handles Error objects', () => {
    assert.ok(isRegistrationMissingError(new Error('Not registered')));
  });

  it('returns false for unrelated messages', () => {
    assert.ok(!isRegistrationMissingError('connected'));
    assert.ok(!isRegistrationMissingError('some other error'));
  });
});

// ---------------------------------------------------------------------------
// getWarpCli
// ---------------------------------------------------------------------------
describe('getWarpCli', () => {
  it('returns default when settings is null', () => {
    assert.equal(getWarpCli(null), WARP_CLI_DEFAULT);
  });

  it('returns default when USE_CUSTOM_WARP_CLI is false', () => {
    const settings = {
      get_boolean: () => false,
      get_string: () => '/custom/path',
    };
    assert.equal(getWarpCli(settings), WARP_CLI_DEFAULT);
  });

  it('returns custom path when USE_CUSTOM_WARP_CLI is true and path is set', () => {
    const settings = {
      get_boolean: () => true,
      get_string: () => '/custom/warp-cli',
    };
    assert.equal(getWarpCli(settings), '/custom/warp-cli');
  });

  it('falls back to default when custom path is empty', () => {
    const settings = {
      get_boolean: () => true,
      get_string: () => '',
    };
    assert.equal(getWarpCli(settings), WARP_CLI_DEFAULT);
  });

  it('falls back to default when custom path is whitespace-only', () => {
    const settings = {
      get_boolean: () => true,
      get_string: () => '   ',
    };
    assert.equal(getWarpCli(settings), WARP_CLI_DEFAULT);
  });

  it('trims whitespace from custom path', () => {
    const settings = {
      get_boolean: () => true,
      get_string: () => '  /custom/warp-cli  ',
    };
    assert.equal(getWarpCli(settings), '/custom/warp-cli');
  });
});
