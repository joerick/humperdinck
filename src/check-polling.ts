import type { CheckStatusSummary } from '@/model/Commit';

export const INITIAL_CHECK_POLL_DELAY = 2_000;
export const MAX_CHECK_POLL_DELAY = 60 * 60 * 1_000;
export const CHECK_POLL_BACKOFF = 1.648;

export function checkSummariesEqual(
  left: CheckStatusSummary,
  right: CheckStatusSummary,
): boolean {
  return left.status === right.status
    && left.total === right.total
    && left.passed === right.passed
    && left.pending === right.pending
    && left.failed === right.failed;
}

export function nextCheckPollDelay(
  currentDelay: number,
  changed: boolean,
): number {
  if (changed) return INITIAL_CHECK_POLL_DELAY;
  return Math.min(MAX_CHECK_POLL_DELAY, Math.round(currentDelay * CHECK_POLL_BACKOFF));
}
