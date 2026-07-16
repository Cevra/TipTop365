// Consent policy versions (E12.2, §8.5 BiH ZZLP). Pure. Bumping a version
// here makes every user "missing" that consent again — the UI re-prompts and
// records a fresh row (consents are append-only history, never updated).

import type { ConsentKind } from '@prisma/client';

export const POLICY_VERSIONS: Record<ConsentKind, string> = {
  tos: '2026-07',
  privacy: '2026-07',
  photos: '2026-07',
  marketing: '2026-07',
};

/** Consents a user must (re-)give: no row yet for the CURRENT version. */
export function missingConsents(
  existing: { kind: ConsentKind; version: string }[],
  required: ConsentKind[] = ['tos', 'privacy'],
): ConsentKind[] {
  return required.filter(
    (kind) => !existing.some((c) => c.kind === kind && c.version === POLICY_VERSIONS[kind]),
  );
}
