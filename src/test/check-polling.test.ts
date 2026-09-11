import { describe, expect, it } from 'vitest';
import {
  CHECK_POLL_BACKOFF,
  INITIAL_CHECK_POLL_DELAY,
  MAX_CHECK_POLL_DELAY,
  checkSummariesEqual,
  nextCheckPollDelay,
} from '@/check-polling';
import type { CheckStatusSummary } from '@/model/Commit';

const PENDING: CheckStatusSummary = {
  status: 'pending',
  total: 2,
  passed: 1,
  pending: 1,
  failed: 0,
};

describe('check polling', () => {
  it('compares the complete check summary', () => {
    expect(checkSummariesEqual(PENDING, { ...PENDING })).toBe(true);
    expect(checkSummariesEqual(PENDING, {
      ...PENDING,
      passed: 2,
      pending: 0,
      status: 'success',
    })).toBe(false);
  });

  it('backs off unchanged checks by 1.648 and resets after a change', () => {
    expect(nextCheckPollDelay(INITIAL_CHECK_POLL_DELAY, false))
      .toBe(Math.round(INITIAL_CHECK_POLL_DELAY * CHECK_POLL_BACKOFF));
    expect(nextCheckPollDelay(50_000, true)).toBe(INITIAL_CHECK_POLL_DELAY);
  });

  it('caps the delay at one hour', () => {
    expect(nextCheckPollDelay(MAX_CHECK_POLL_DELAY, false)).toBe(MAX_CHECK_POLL_DELAY);
    expect(nextCheckPollDelay(MAX_CHECK_POLL_DELAY - 1, false)).toBe(MAX_CHECK_POLL_DELAY);
  });
});
