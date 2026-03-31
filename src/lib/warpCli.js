import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { Settings, State } from './warpTypes.js';

// cli location
export const WARP_CLI_DEFAULT = GLib.getenv('WARP_CLI') || 'warp-cli';

// command parameters (arrays to avoid split-on-space pitfalls)
export const COMMAND_CONNECT = ['connect'];
export const COMMAND_DISCONNECT = ['disconnect'];
const COMMAND_STATUS = ['status'];
export const COMMAND_REGISTRATION_ORG = ['registration', 'organization'];
export const COMMAND_REGISTRATION_SHOW = ['registration', 'show'];

const REGISTRATION_INFO_PATTERNS = [
  {
    type: 'organization',
    detailType: 'organization',
    pattern: /^organization:\s*(.+)/im,
  },
  {
    type: 'personal',
    detailType: 'email',
    pattern: /^email:\s*(.+)/im,
  },
  {
    type: 'personal',
    detailType: 'account',
    pattern: /^account name:\s*(.+)/im,
  },
];

// status strings used for parsing
const STATUS_CONNECTED = 'connected';
const STATUS_CONNECTING = 'connecting';
const STATUS_DISCONNECTED = 'disconnected';

// subtitle prefixes
const SUBTITLE_PREFIX_ORG = 'Org: ';
const SUBTITLE_PREFIX_PERSONAL = 'Acc: ';
export const SUBTITLE_NOT_REGISTERED = 'Not registered \u00b7 Click to set up';

// error pattern groups
const DISABLED_ERROR_PATTERNS = [
  'no such file or directory',
  'failed to execute child process',
  'unable to connect',
  'daemon',
  'service not running',
];

const NO_ROUTE_ERROR_PATTERNS = [
  'network is unreachable',
  'no route to host',
  'could not resolve host',
  'name or service not known',
];

const OFFLINE_ERROR_PATTERNS = ['offline', 'timed out'];

// Resolves the warp-cli executable path from settings or falls back to the default.
export function getWarpCli(settings) {
  if (settings && settings.get_boolean(Settings.USE_CUSTOM_WARP_CLI)) {
    const custom = settings.get_string(Settings.CUSTOM_WARP_CLI_PATH)?.trim();
    if (custom) return custom;
  }
  return WARP_CLI_DEFAULT;
}

// Executes a warp-cli command and returns its stdout output.
// `args` must be an array of argument strings, e.g. ['status'].
// `cancellable` is an optional Gio.Cancellable to abort the operation.
export async function runCommand(
  args,
  warpCli = WARP_CLI_DEFAULT,
  cancellable = null,
) {
  return new Promise((resolve, reject) => {
    try {
      const proc = new Gio.Subprocess({
        argv: [warpCli, ...args],
        flags:
          Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
      });
      proc.init(cancellable);
      proc.communicate_utf8_async(null, cancellable, (proc, res) => {
        try {
          let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
          if (!ok || proc.get_exit_status() !== 0) {
            reject(stderr);
            return;
          }
          resolve(stdout ? stdout.trim() : '');
        } catch (e) {
          reject(e);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

export function isRegistrationMissingError(message) {
  const normalizedMessage = `${message}`.toLowerCase();
  return (
    normalizedMessage.includes('not registered') ||
    normalizedMessage.includes('registration missing')
  );
}

export function parseRegistrationInfo(info) {
  for (const registrationInfo of REGISTRATION_INFO_PATTERNS) {
    const match = info.match(registrationInfo.pattern);
    if (match) {
      return {
        type: registrationInfo.type,
        detailType: registrationInfo.detailType,
        detail: match[1].trim(),
      };
    }
  }

  return {
    type: 'personal',
    detailType: null,
    detail: null,
  };
}

// Fetches the VPN provider label via `warp-cli registration organization`
// (Teams) or `registration show` (personal).
// Returns a prefixed string: "Org: <name>" or "Acc: <name>",
// SUBTITLE_NOT_REGISTERED when no account is linked yet, or null when no
// identifiable info is available.
export async function getVpnProvider(warpCli, cancellable = null) {
  try {
    const org = await runCommand(
      COMMAND_REGISTRATION_ORG,
      warpCli,
      cancellable,
    );
    if (org) {
      return SUBTITLE_PREFIX_ORG + org;
    }
  } catch (err) {
    if (isRegistrationMissingError(err)) {
      return SUBTITLE_NOT_REGISTERED;
    }
    // Not a Teams account — fall through to registration show
  }

  try {
    const info = await runCommand(
      COMMAND_REGISTRATION_SHOW,
      warpCli,
      cancellable,
    );
    const registrationInfo = parseRegistrationInfo(info);
    if (registrationInfo.type === 'organization' && registrationInfo.detail) {
      return SUBTITLE_PREFIX_ORG + registrationInfo.detail;
    }
    if (registrationInfo.detail) {
      return SUBTITLE_PREFIX_PERSONAL + registrationInfo.detail;
    }
    // Personal account but no identifiable info
    return null;
  } catch (err) {
    if (isRegistrationMissingError(err)) {
      return SUBTITLE_NOT_REGISTERED;
    }
    return null;
  }
}

// Parses the stdout of `warp-cli status` into a State.* value.
export function parseWarpStatus(statusOutput) {
  if (!statusOutput) {
    return State.ERROR;
  }

  const status = statusOutput.toLowerCase();
  // IMPORTANT: Check 'disconnected' before 'connected' —
  // 'connected' is a substring of 'disconnected'.
  if (status.includes(STATUS_DISCONNECTED)) {
    return State.DISCONNECTED;
  }
  if (status.includes(STATUS_CONNECTING)) {
    return State.CONNECTING;
  }
  if (status.includes(STATUS_CONNECTED)) {
    return State.CONNECTED;
  }
  if (DISABLED_ERROR_PATTERNS.some((pattern) => status.includes(pattern))) {
    return State.DISABLED;
  }
  if (NO_ROUTE_ERROR_PATTERNS.some((pattern) => status.includes(pattern))) {
    return State.NO_ROUTE;
  }
  if (OFFLINE_ERROR_PATTERNS.some((pattern) => status.includes(pattern))) {
    return State.OFFLINE;
  }

  return State.ERROR;
}

// Classifies a warp-cli error into a State.* value.
export function classifyWarpFailure(err) {
  const message = `${err}`.toLowerCase();
  if (DISABLED_ERROR_PATTERNS.some((pattern) => message.includes(pattern))) {
    return State.DISABLED;
  }
  if (NO_ROUTE_ERROR_PATTERNS.some((pattern) => message.includes(pattern))) {
    return State.NO_ROUTE;
  }
  if (OFFLINE_ERROR_PATTERNS.some((pattern) => message.includes(pattern))) {
    return State.OFFLINE;
  }
  return State.ERROR;
}

// Runs `warp-cli status` and returns the parsed State.* value.
// Never throws — classifies CLI failures into a State.* value.
export async function getWarpState(warpCli, cancellable = null) {
  try {
    const status = await runCommand(COMMAND_STATUS, warpCli, cancellable);
    return parseWarpStatus(status);
  } catch (err) {
    return classifyWarpFailure(err);
  }
}
