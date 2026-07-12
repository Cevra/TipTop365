import 'server-only';
import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

// Lazy singleton: never initialized at import time, so `next build` (CI) and the
// Edge runtime don't need real credentials. First actual call to adminAuth()
// initializes from either FIREBASE_SERVICE_ACCOUNT_JSON (inline, for serverless)
// or FIREBASE_SERVICE_ACCOUNT_PATH (a file, for local dev). Throws only when used
// without credentials — never at module load.

let cached: App | undefined;

function loadServiceAccount(): Record<string, unknown> {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    return JSON.parse(inline);
  }
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (path) {
    return JSON.parse(readFileSync(path, 'utf8'));
  }
  throw new Error(
    'Firebase admin credentials missing: set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH.',
  );
}

function adminApp(): App {
  if (cached) return cached;
  cached = getApps()[0] ?? initializeApp({ credential: cert(loadServiceAccount() as never) });
  return cached;
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}
