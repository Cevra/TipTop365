// Anti-disintermediation chat masking (E4.5, plan §12.4). Pure. Detects and
// masks contact details in BiH formats before a message is stored — the raw
// body is never persisted. Replacement is ▮▮▮ + the flag reason drives the
// warning UX and the 3-strikes admin review.

import type { ChatFlagReason } from '@prisma/client';

export const MASK = '▮▮▮';

// BiH phone shapes: +387 6x/3x…, 00387…, and domestic 06x with 6–7 digits,
// tolerant of spaces, dashes, dots, and parentheses between digits.
const PHONE_RE =
  /(?:\+\s*3\s*8\s*7|0\s*0\s*3\s*8\s*7|\b0\s*[36]\s*\d)(?:[\s\-./()]*\d){5,10}/g;

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Spelled-out obfuscations: "ime (at) gmail (dot) com"
const EMAIL_OBFUSCATED_RE =
  /\b[\w.+-]{2,}\s*[([]?\s*(?:at|et)\s*[)\]]?\s*[\w-]{2,}\s*[([]?\s*(?:dot|tačka|tacka)\s*[)\]]?\s*[a-z]{2,6}\b/gi;

// Social handles & app mentions: @handle, or a platform keyword (a route to
// off-platform contact even without a number next to it).
const HANDLE_RE = /(?<![\w.])@[A-Za-z0-9_.]{3,30}\b/g;
const SOCIAL_KEYWORD_RE =
  /\b(?:instagram|insta|viber|whatsapp|whats\s?app|telegram|facebook|messenger|snapchat|tiktok)\b(?:[\s:.-]*@?[A-Za-z0-9_.]{3,30})?/gi;

export interface MaskResult {
  masked: string;
  flagged: boolean;
  /** First reason — the column stores one; callers keep the full list. */
  flagReason: ChatFlagReason | null;
  reasons: ChatFlagReason[];
}

function hasMatch(re: RegExp, text: string): boolean {
  re.lastIndex = 0;
  return re.test(text);
}

export function maskContacts(body: string): MaskResult {
  const reasons: ChatFlagReason[] = [];
  let masked = body;

  if (hasMatch(PHONE_RE, masked)) {
    reasons.push('phone');
    masked = masked.replace(PHONE_RE, MASK);
  }
  if (hasMatch(EMAIL_RE, masked) || hasMatch(EMAIL_OBFUSCATED_RE, masked)) {
    reasons.push('email');
    masked = masked.replace(EMAIL_RE, MASK).replace(EMAIL_OBFUSCATED_RE, MASK);
  }
  if (hasMatch(HANDLE_RE, masked) || hasMatch(SOCIAL_KEYWORD_RE, masked)) {
    reasons.push('social');
    masked = masked.replace(HANDLE_RE, MASK).replace(SOCIAL_KEYWORD_RE, MASK);
  }

  return {
    masked,
    flagged: reasons.length > 0,
    flagReason: reasons[0] ?? null,
    reasons,
  };
}

/** §12.4: 3 flagged messages by one sender in one booking → admin review. */
export const FLAGS_BEFORE_ADMIN_REVIEW = 3;
