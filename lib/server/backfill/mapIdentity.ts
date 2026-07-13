// Pure mapping functions: legacy Firestore document shapes → Prisma create
// inputs for the identity block (E1.1). No I/O here — the I/O adapter is
// scripts/backfill-identity.mjs; these stay unit-testable without a DB.
//
// Source shapes (verified against the writing code, not guessed):
// - users/{uid}: signup + profile pages (firstName, lastName, email, phoneNumber,
//   role 'user'|'provider', profileImageUrl, addressId?, description?, pricePerHour?, …)
// - providers/{uid}: become-provider page — ServiceProvider in lib/shared/types.ts
// - address/{id}: Address in lib/shared/types.ts, referenced by users.addressId

import type { Prisma, UserRole } from '@prisma/client';
import type { Address, Availability, ServiceProvider } from '../../shared/types';

export interface LegacyUserDoc {
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  role?: string; // 'user' | 'provider' (legacy values)
  addressId?: string;
  profileImageUrl?: string;
  description?: string;
  pricePerHour?: number;
  gender?: string;
  availability?: Availability;
}

/** Legacy 'provider' → cleaner; everything else (incl. missing) → customer. */
export function mapRole(legacyRole: string | undefined): UserRole {
  return legacyRole === 'provider' ? 'cleaner' : 'customer';
}

/**
 * KM (possibly fractional, from a numeric Firestore field) → integer fenings (D5).
 * Returns null for missing/invalid/non-positive input rather than guessing.
 */
export function toFenings(km: number | undefined | null): number | null {
  if (typeof km !== 'number' || !Number.isFinite(km) || km <= 0) return null;
  return Math.round(km * 100);
}

/** City display name → slug used as the City upsert key ("Banja Luka" → "banja-luka"). */
export function resolveCitySlug(cityName: string): string {
  return cityName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics (Č → C …)
    .replace(/đ/g, 'dj')
    .replace(/Đ/g, 'dj')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function mapUserDoc(
  doc: LegacyUserDoc,
  firebaseUid: string,
): Prisma.UserCreateInput | null {
  if (!doc.email) return null; // email is required + unique; unmappable without it
  return {
    firebaseUid,
    email: doc.email,
    firstName: doc.firstName || null,
    lastName: doc.lastName || null,
    phone: doc.phoneNumber || null,
    role: mapRole(doc.role),
  };
}

/**
 * providers/{uid} → CleanerProfile create input (minus relations — the script
 * connects user/city by id). Rating aggregates carry over; tier stays
 * `registered` (default): nobody was verified under the old app.
 */
export function mapProviderToCleanerProfile(
  provider: Partial<ServiceProvider>,
): Omit<Prisma.CleanerProfileCreateInput, 'user' | 'city'> {
  return {
    bio: provider.description || null,
    photoUrl: provider.profileImageUrl || null,
    gender: provider.gender || null,
    hourlyRateF: toFenings(provider.pricePerHour),
    lat: provider.location?.latitude ?? null,
    lng: provider.location?.longitude ?? null,
    availability: provider.availability
      ? (provider.availability as unknown as Prisma.InputJsonValue)
      : undefined,
    languages: provider.languages ?? [],
    ratingAvg: provider.rating?.average ?? null,
    ratingCount: provider.rating?.count ?? 0,
  };
}

/**
 * address/{id} → Property create input (minus relations). Legacy addresses have
 * no label/m²/rooms — those stay null until the owner edits the property (E3.1).
 */
export function mapAddressToProperty(
  address: Partial<Address>,
): Omit<Prisma.PropertyCreateInput, 'owner' | 'city'> {
  return {
    street: address.street || null,
    houseNo: address.houseNumber || null,
    floor: address.floor || null,
    accessNotes: address.additionalInfo || null,
  };
}

/** City name as found on a legacy doc (provider.address.city or address.city). */
export function extractCityName(doc: {
  address?: { city?: string };
  city?: string;
}): string | null {
  const raw = doc.address?.city ?? doc.city;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}
