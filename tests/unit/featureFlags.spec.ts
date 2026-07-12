import { describe, expect, it } from 'vitest';
import {
  FEATURE_FLAGS,
  FEATURE_FLAG_KEYS,
  flagEnvVar,
  resolveFlag,
} from '@/lib/shared/featureFlags';

describe('resolveFlag precedence', () => {
  it('uses the coded default when nothing else is set', () => {
    expect(resolveFlag('SMS_ENABLED', {})).toBe(false);
    expect(resolveFlag('CASH_PAYMENTS_ENABLED', {})).toBe(true);
  });

  it('DB value overrides the default', () => {
    expect(resolveFlag('SMS_ENABLED', { dbValue: true })).toBe(true);
    expect(resolveFlag('CASH_PAYMENTS_ENABLED', { dbValue: false })).toBe(false);
  });

  it('null/undefined DB value falls through to default', () => {
    expect(resolveFlag('CASH_PAYMENTS_ENABLED', { dbValue: null })).toBe(true);
    expect(resolveFlag('SMS_ENABLED', { dbValue: undefined })).toBe(false);
  });

  it('env override beats both DB and default', () => {
    expect(resolveFlag('SMS_ENABLED', { envValue: 'true', dbValue: false })).toBe(true);
    expect(resolveFlag('CASH_PAYMENTS_ENABLED', { envValue: 'off', dbValue: true })).toBe(false);
  });

  it.each(['1', 'true', 'YES', 'On'])('parses %s as true', (v) => {
    expect(resolveFlag('SMS_ENABLED', { envValue: v })).toBe(true);
  });

  it.each(['0', 'false', 'NO', 'Off'])('parses %s as false', (v) => {
    expect(resolveFlag('CASH_PAYMENTS_ENABLED', { envValue: v })).toBe(false);
  });

  it('ignores an unrecognized env value and falls through', () => {
    expect(resolveFlag('SMS_ENABLED', { envValue: 'maybe', dbValue: true })).toBe(true);
    expect(resolveFlag('SMS_ENABLED', { envValue: 'garbage' })).toBe(false);
  });
});

describe('flag registry', () => {
  it('exposes the required launch flags', () => {
    expect(FEATURE_FLAG_KEYS).toEqual(
      expect.arrayContaining(['ALLOW_UNVERIFIED_BOOKINGS', 'CASH_PAYMENTS_ENABLED']),
    );
  });

  it('every flag has a description and boolean default', () => {
    for (const key of FEATURE_FLAG_KEYS) {
      expect(typeof FEATURE_FLAGS[key].default).toBe('boolean');
      expect(FEATURE_FLAGS[key].description.length).toBeGreaterThan(0);
    }
  });

  it('builds env var names', () => {
    expect(flagEnvVar('ALLOW_UNVERIFIED_BOOKINGS')).toBe('FLAG_ALLOW_UNVERIFIED_BOOKINGS');
  });
});
