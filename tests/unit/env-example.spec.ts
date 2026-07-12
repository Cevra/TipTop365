import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Guards the onboarding contract: every env var the app needs must be
// documented in .env.example (plan §16). Fails when someone adds a
// process.env dependency without documenting it.
const REQUIRED_KEYS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'DATABASE_URL',
  'DIRECT_URL',
  'FIREBASE_SERVICE_ACCOUNT_PATH',
];

describe('.env.example', () => {
  const example = readFileSync('.env.example', 'utf8');

  it.each(REQUIRED_KEYS)('documents %s', (key) => {
    expect(example).toMatch(new RegExp(`^${key}=`, 'm'));
  });
});
