import { describe, expect, it } from 'vitest';
import { MASK, maskContacts } from '@/lib/domain/chatMasking';

describe('chat masking (E4.5, §12.4)', () => {
  it('masks BiH phone formats in all common shapes', () => {
    for (const text of [
      'Zovi me na +387 61 123 456',
      'moj broj 061123456',
      'broj: 061-123-456',
      'na 00387 61 123 456 sam',
      'viber 061 123 4567',
      '(061) 123 456',
      '033 123 456', // landline
    ]) {
      const result = maskContacts(text);
      expect(result.flagged, text).toBe(true);
      expect(result.masked, text).toContain(MASK);
      expect(result.masked.replace(/\D/g, ''), text).not.toMatch(/\d{6,}/);
    }
  });

  it('masks emails including spelled-out obfuscations', () => {
    expect(maskContacts('pišite na amina.h@gmail.com').reasons).toContain('email');
    expect(maskContacts('amina (at) gmail (dot) com').reasons).toContain('email');
    expect(maskContacts('amina at gmail tačka com').reasons).toContain('email');
  });

  it('masks social handles and platform mentions', () => {
    expect(maskContacts('nađi me na instagramu @amina.cisti').reasons).toContain('social');
    expect(maskContacts('imaš whatsapp?').reasons).toContain('social');
    expect(maskContacts('dodaj me na viber').reasons).toContain('social');
  });

  it('collects multiple reasons, first one wins the column', () => {
    const result = maskContacts('zovi 061 123 456 ili piši na x@y.ba');
    expect(result.reasons).toEqual(['phone', 'email']);
    expect(result.flagReason).toBe('phone');
  });

  it('leaves normal cleaning talk untouched', () => {
    for (const text of [
      'Stižem u 10, ponesite ključ molim Vas.',
      'Stan je 75 m², 3 sobe i 2 kupatila.',
      'Cijena je 57,60 KM za 4 sata.',
      'Termin pomjeren na 12.8.2026. u 14:00.',
      'Trebam još 30 minuta.',
    ]) {
      const result = maskContacts(text);
      expect(result.flagged, text).toBe(false);
      expect(result.masked, text).toBe(text);
    }
  });
});
