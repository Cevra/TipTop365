// E1.1 backfill: legacy Firestore (users / providers / address) → Postgres
// identity tables. DRY RUN by default — prints a report and touches nothing.
// Pass --commit to write. Idempotent: upserts keyed on firebase_uid / slug /
// user_id, so re-running is safe.
//
// Usage:  npm run db:backfill:identity            (dry run)
//         npm run db:backfill:identity -- --commit
//
// Runs under `node --import tsx` so it can import the pure, unit-tested mapping
// module (lib/server/backfill/mapIdentity.ts); this file is only the I/O adapter,
// per the seed-flags.mjs pattern.

import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  extractCityName,
  mapAddressToProperty,
  mapProviderToCleanerProfile,
  mapUserDoc,
  resolveCitySlug,
} from '../lib/server/backfill/mapIdentity.ts';

const COMMIT = process.argv.includes('--commit');

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    return JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
  }
  throw new Error('Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH');
}

const firestore = getFirestore(initializeApp({ credential: cert(loadServiceAccount()) }));
const prisma = new PrismaClient();

// --- Read everything (reads only — Firestore stays untouched) ----------------
const [userSnap, providerSnap, addressSnap] = await Promise.all([
  firestore.collection('users').get(),
  firestore.collection('providers').get(),
  firestore.collection('address').get(),
]);

const addressById = new Map(addressSnap.docs.map((d) => [d.id, d.data()]));
// Older app versions wrote providers with addDoc (auto doc ID) and only kept the
// auth uid in the `uid` field; the current app writes setDoc(doc('providers', uid)).
// Key on the uid field first, doc ID as fallback, so both generations match.
const providerByUid = new Map(providerSnap.docs.map((d) => [d.data().uid ?? d.id, d.data()]));
const userUids = new Set(userSnap.docs.map((d) => d.id));

const report = {
  read: { users: userSnap.size, providers: providerSnap.size, addresses: addressSnap.size },
  skippedUsers: [],
  orphanProviders: [...providerByUid.keys()].filter((uid) => !userUids.has(uid)),
  orphanAddressRefs: [],
  cities: new Map(), // display name -> slug
};

// --- Map (pure functions; one plan per legacy user) ---------------------------
const plans = [];

for (const doc of userSnap.docs) {
  const data = doc.data();
  const user = mapUserDoc(data, doc.id);
  if (!user) {
    report.skippedUsers.push({ uid: doc.id, reason: 'missing email' });
    continue;
  }
  const plan = { uid: doc.id, user };

  const provider = providerByUid.get(doc.id);
  if (provider) {
    plan.profile = mapProviderToCleanerProfile(provider);
    plan.profileCity = extractCityName(provider);
    if (plan.profileCity) report.cities.set(plan.profileCity, resolveCitySlug(plan.profileCity));
  }

  if (data.addressId) {
    const address = addressById.get(data.addressId);
    if (address) {
      plan.property = mapAddressToProperty(address);
      plan.propertyCity = extractCityName(address);
      if (plan.propertyCity)
        report.cities.set(plan.propertyCity, resolveCitySlug(plan.propertyCity));
    } else {
      report.orphanAddressRefs.push({ uid: doc.id, addressId: data.addressId });
    }
  }

  plans.push(plan);
}

// --- Report --------------------------------------------------------------------
const profiles = plans.filter((p) => p.profile).length;
const properties = plans.filter((p) => p.property).length;

console.log(`\n=== Identity backfill ${COMMIT ? 'COMMIT' : 'DRY RUN'} ===`);
console.log('Read from Firestore:', report.read);
console.log(`users: ${plans.length} mapped, ${report.skippedUsers.length} skipped`);
for (const s of report.skippedUsers) console.log(`  skip ${s.uid} — ${s.reason}`);
console.log(`cleaner_profiles: ${profiles} mapped`);
for (const uid of report.orphanProviders)
  console.log(`  orphan providers/{${uid}} has no users doc — NOT migrated`);
console.log(`properties: ${properties} mapped, ${report.orphanAddressRefs.length} dangling addressId refs`);
for (const o of report.orphanAddressRefs)
  console.log(`  user ${o.uid} references missing address/${o.addressId}`);
console.log(
  'cities to upsert:',
  [...report.cities.entries()].map(([n, s]) => `${n} → ${s}`).join(', ') || '(none)',
);

if (!COMMIT) {
  console.log('\nDry run — nothing written. Re-run with `-- --commit` to apply.');
  await prisma.$disconnect();
  process.exit(0);
}

// --- Commit ----------------------------------------------------------------------
try {
  const cityIdBySlug = new Map();
  for (const [name, slug] of report.cities) {
    const city = await prisma.city.upsert({ where: { slug }, create: { name, slug }, update: {} });
    cityIdBySlug.set(slug, city.id);
  }

  let usersWritten = 0;
  let profilesWritten = 0;
  let propertiesWritten = 0;

  for (const plan of plans) {
    // update: {} everywhere — the backfill must never clobber rows the new app owns.
    const user = await prisma.user.upsert({
      where: { firebaseUid: plan.uid },
      create: plan.user,
      update: {},
    });
    usersWritten++;

    if (plan.profile) {
      const cityId = plan.profileCity && cityIdBySlug.get(resolveCitySlug(plan.profileCity));
      await prisma.cleanerProfile.upsert({
        where: { userId: user.id },
        create: {
          ...plan.profile,
          user: { connect: { id: user.id } },
          ...(cityId ? { city: { connect: { id: cityId } } } : {}),
        },
        update: {},
      });
      profilesWritten++;
    }

    if (plan.property) {
      const cityId = plan.propertyCity && cityIdBySlug.get(resolveCitySlug(plan.propertyCity));
      const existing = await prisma.property.findFirst({
        where: { ownerId: user.id, street: plan.property.street, houseNo: plan.property.houseNo },
      });
      if (!existing) {
        await prisma.property.create({
          data: {
            ...plan.property,
            owner: { connect: { id: user.id } },
            ...(cityId ? { city: { connect: { id: cityId } } } : {}),
          },
        });
        propertiesWritten++;
      }
    }
  }

  console.log(
    `\nCommitted: ${usersWritten} users, ${profilesWritten} cleaner profiles, ` +
      `${propertiesWritten} new properties, ${cityIdBySlug.size} cities.`,
  );
} finally {
  await prisma.$disconnect();
}
