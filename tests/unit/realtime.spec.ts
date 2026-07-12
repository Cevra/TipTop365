import { describe, expect, it } from 'vitest';
import {
  resolvePollInterval,
  POLL_INTERVAL_CHAT_MS,
  POLL_INTERVAL_MAP_MS,
} from '@/lib/shared/realtime';

describe('resolvePollInterval', () => {
  it('returns the base interval while visible', () => {
    expect(resolvePollInterval(4000, true)).toBe(4000);
    expect(resolvePollInterval(10000, true)).toBe(10000);
  });

  it('pauses (null) while the tab is hidden', () => {
    expect(resolvePollInterval(4000, false)).toBeNull();
  });
});

describe('poll cadence constants', () => {
  it('polls chat more often than the map', () => {
    expect(POLL_INTERVAL_CHAT_MS).toBeLessThan(POLL_INTERVAL_MAP_MS);
  });
});
