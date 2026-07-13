import { describe, expect, it } from 'vitest';
import {
  extractCityName,
  mapAddressToProperty,
  mapProviderToCleanerProfile,
  mapRole,
  mapUserDoc,
  resolveCitySlug,
  toFenings,
} from '@/lib/server/backfill/mapIdentity';

describe('mapRole', () => {
  it("maps legacy 'provider' to cleaner", () => {
    expect(mapRole('provider')).toBe('cleaner');
  });

  it("maps legacy 'user', unknown and missing values to customer", () => {
    expect(mapRole('user')).toBe('customer');
    expect(mapRole('whatever')).toBe('customer');
    expect(mapRole(undefined)).toBe('customer');
  });
});

describe('toFenings (D5 — KM to integer fenings)', () => {
  it('converts whole and fractional KM', () => {
    expect(toFenings(10)).toBe(1000);
    expect(toFenings(12.5)).toBe(1250);
    // float-hostile input still lands on an exact integer
    expect(toFenings(57.6)).toBe(5760);
  });

  it('returns null for missing, zero, negative or non-finite input', () => {
    expect(toFenings(undefined)).toBeNull();
    expect(toFenings(null)).toBeNull();
    expect(toFenings(0)).toBeNull();
    expect(toFenings(-8)).toBeNull();
    expect(toFenings(Number.NaN)).toBeNull();
    expect(toFenings(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('resolveCitySlug', () => {
  it('slugifies simple and multi-word names', () => {
    expect(resolveCitySlug('Sarajevo')).toBe('sarajevo');
    expect(resolveCitySlug('Banja Luka')).toBe('banja-luka');
  });

  it('handles Bosnian diacritics', () => {
    expect(resolveCitySlug('Brčko')).toBe('brcko');
    expect(resolveCitySlug('Bihać')).toBe('bihac');
    expect(resolveCitySlug('Goražde')).toBe('gorazde');
  });

  it('trims and collapses separators', () => {
    expect(resolveCitySlug('  Novi   Grad  ')).toBe('novi-grad');
  });
});

describe('mapUserDoc', () => {
  it('maps a full legacy user doc', () => {
    const user = mapUserDoc(
      {
        email: 'amina@example.ba',
        firstName: 'Amina',
        lastName: 'Hodžić',
        phoneNumber: '+38761111222',
        role: 'provider',
      },
      'uid-1',
    );
    expect(user).toEqual({
      firebaseUid: 'uid-1',
      email: 'amina@example.ba',
      firstName: 'Amina',
      lastName: 'Hodžić',
      phone: '+38761111222',
      role: 'cleaner',
    });
  });

  it('returns null without an email (unmappable)', () => {
    expect(mapUserDoc({ firstName: 'X' }, 'uid-2')).toBeNull();
  });

  it('normalizes empty strings to null', () => {
    const user = mapUserDoc({ email: 'a@b.ba', firstName: '', phoneNumber: '' }, 'uid-3');
    expect(user?.firstName).toBeNull();
    expect(user?.phone).toBeNull();
  });
});

describe('mapProviderToCleanerProfile', () => {
  it('maps the become-provider document shape', () => {
    const profile = mapProviderToCleanerProfile({
      description: 'Iskusna čistačica',
      profileImageUrl: 'https://x/img.jpg',
      gender: 'female',
      pricePerHour: 12,
      location: { latitude: 43.85, longitude: 18.41 },
      languages: ['bs', 'en'],
      rating: { average: 4.8, count: 21 },
    });
    expect(profile).toMatchObject({
      bio: 'Iskusna čistačica',
      photoUrl: 'https://x/img.jpg',
      gender: 'female',
      hourlyRateF: 1200,
      lat: 43.85,
      lng: 18.41,
      languages: ['bs', 'en'],
      ratingAvg: 4.8,
      ratingCount: 21,
    });
  });

  it('defaults sparse docs safely', () => {
    const profile = mapProviderToCleanerProfile({});
    expect(profile.hourlyRateF).toBeNull();
    expect(profile.languages).toEqual([]);
    expect(profile.ratingAvg).toBeNull();
    expect(profile.ratingCount).toBe(0);
    expect(profile.lat).toBeNull();
  });
});

describe('mapAddressToProperty', () => {
  it('maps the legacy address document', () => {
    expect(
      mapAddressToProperty({
        street: 'Ferhadija',
        houseNumber: '12',
        floor: '3',
        additionalInfo: 'interfon 3B',
      }),
    ).toEqual({
      street: 'Ferhadija',
      houseNo: '12',
      floor: '3',
      accessNotes: 'interfon 3B',
    });
  });

  it('normalizes missing fields to null', () => {
    const property = mapAddressToProperty({});
    expect(property.street).toBeNull();
    expect(property.houseNo).toBeNull();
    expect(property.floor).toBeNull();
    expect(property.accessNotes).toBeNull();
  });
});

describe('extractCityName', () => {
  it('reads nested provider address city', () => {
    expect(extractCityName({ address: { city: 'Sarajevo' } })).toBe('Sarajevo');
  });

  it('reads flat address-doc city', () => {
    expect(extractCityName({ city: 'Mostar' })).toBe('Mostar');
  });

  it('returns null for missing or blank city', () => {
    expect(extractCityName({})).toBeNull();
    expect(extractCityName({ city: '   ' })).toBeNull();
  });
});
