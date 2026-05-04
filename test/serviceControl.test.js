import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { makeServiceAuthError } from '../src/lib/serviceControl/errors.js';
import {
  getServiceName,
  resolveServiceBackend,
} from '../src/lib/serviceControl/index.js';
import {
  ServiceAuthErrorCode,
  ServiceAuthBackend,
  Settings,
} from '../src/lib/warpTypes.js';

// ---------------------------------------------------------------------------
// makeServiceAuthError
// ---------------------------------------------------------------------------
describe('makeServiceAuthError', () => {
  it('creates an Error with the given message', () => {
    const err = makeServiceAuthError('test error', 'failed', 'pkexec');
    assert.ok(err instanceof Error);
    assert.equal(err.message, 'test error');
  });

  it('sets code and backend properties', () => {
    const err = makeServiceAuthError('msg', 'denied', 'systemd-dbus');
    assert.equal(err.code, 'denied');
    assert.equal(err.backend, 'systemd-dbus');
  });

  it('sets cancelled=true when code is CANCELLED', () => {
    const err = makeServiceAuthError(
      'user cancelled',
      ServiceAuthErrorCode.CANCELLED,
      'pkexec',
    );
    assert.equal(err.cancelled, true);
  });

  it('sets cancelled=false for non-CANCELLED codes', () => {
    const err = makeServiceAuthError(
      'denied',
      ServiceAuthErrorCode.DENIED,
      'pkexec',
    );
    assert.equal(err.cancelled, false);
  });

  it('sets cancelled=false for FAILED code', () => {
    const err = makeServiceAuthError(
      'failed',
      ServiceAuthErrorCode.FAILED,
      'systemd-dbus',
    );
    assert.equal(err.cancelled, false);
  });

  it('sets cancelled=false for UNAVAILABLE code', () => {
    const err = makeServiceAuthError(
      'unavailable',
      ServiceAuthErrorCode.UNAVAILABLE,
      'pkexec',
    );
    assert.equal(err.cancelled, false);
  });
});

// ---------------------------------------------------------------------------
// getServiceName
// ---------------------------------------------------------------------------
describe('getServiceName', () => {
  const DEFAULT_SERVICE_NAME = 'warp-svc.service';

  it('returns default when settings is null', () => {
    assert.equal(getServiceName(null), DEFAULT_SERVICE_NAME);
  });

  it('returns default when USE_CUSTOM_SERVICE_NAME is false', () => {
    const settings = {
      get_boolean: () => false,
      get_string: () => 'custom.service',
    };
    assert.equal(getServiceName(settings), DEFAULT_SERVICE_NAME);
  });

  it('returns custom name when USE_CUSTOM_SERVICE_NAME is true and name is set', () => {
    const settings = {
      get_boolean: () => true,
      get_string: () => 'my-warp.service',
    };
    assert.equal(getServiceName(settings), 'my-warp.service');
  });

  it('falls back to default when custom name is empty', () => {
    const settings = {
      get_boolean: () => true,
      get_string: () => '',
    };
    assert.equal(getServiceName(settings), DEFAULT_SERVICE_NAME);
  });

  it('falls back to default when custom name is whitespace-only', () => {
    const settings = {
      get_boolean: () => true,
      get_string: () => '   ',
    };
    assert.equal(getServiceName(settings), DEFAULT_SERVICE_NAME);
  });

  it('trims whitespace from custom name', () => {
    const settings = {
      get_boolean: () => true,
      get_string: () => '  my-warp.service  ',
    };
    assert.equal(getServiceName(settings), 'my-warp.service');
  });
});

// ---------------------------------------------------------------------------
// resolveServiceBackend
// ---------------------------------------------------------------------------
describe('resolveServiceBackend', () => {
  it('returns pkexec when explicitly configured', () => {
    const settings = {
      get_string: (key) => {
        if (key === Settings.SERVICE_AUTH_BACKEND)
          return ServiceAuthBackend.PKEXEC;
        return '';
      },
    };
    assert.equal(resolveServiceBackend(settings), ServiceAuthBackend.PKEXEC);
  });

  it('returns systemd-dbus when explicitly configured', () => {
    const settings = {
      get_string: (key) => {
        if (key === Settings.SERVICE_AUTH_BACKEND)
          return ServiceAuthBackend.SYSTEMD_DBUS;
        return '';
      },
    };
    assert.equal(
      resolveServiceBackend(settings),
      ServiceAuthBackend.SYSTEMD_DBUS,
    );
  });

  it('defaults to auto when settings is null', () => {
    // With mocked GLib (find_program_in_path returns null), auto falls back to systemd-dbus
    assert.equal(resolveServiceBackend(null), ServiceAuthBackend.SYSTEMD_DBUS);
  });

  it('falls back to systemd-dbus in auto mode when pkexec is unavailable', () => {
    const settings = {
      get_string: (key) => {
        if (key === Settings.SERVICE_AUTH_BACKEND)
          return ServiceAuthBackend.AUTO;
        return '';
      },
    };
    // GLib.find_program_in_path is mocked to return null (pkexec not found)
    assert.equal(
      resolveServiceBackend(settings),
      ServiceAuthBackend.SYSTEMD_DBUS,
    );
  });

  it('treats unknown backend values as auto', () => {
    const settings = {
      get_string: () => 'unknown-backend',
    };
    // Falls through to auto logic; pkexec unavailable in mock → systemd-dbus
    assert.equal(
      resolveServiceBackend(settings),
      ServiceAuthBackend.SYSTEMD_DBUS,
    );
  });
});
