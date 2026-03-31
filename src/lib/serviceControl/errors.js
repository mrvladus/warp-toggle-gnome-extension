import { ServiceAuthErrorCode } from '../warpTypes.js';

/**
 * Creates a normalized service-auth error.
 */
export function makeServiceAuthError(message, code, backend) {
  const err = new Error(message);
  err.code = code;
  err.backend = backend;
  err.cancelled = code === ServiceAuthErrorCode.CANCELLED;
  return err;
}
