/**
 * Safely extract a human-readable message from a caught unknown value.
 * Prefer this over `error as Error` — thrown values are not always Error instances.
 */
export function getErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return fallback;
}
