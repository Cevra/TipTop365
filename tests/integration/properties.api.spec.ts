import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { SessionClaims } from '@/lib/shared/access';

// Integration (E3.1): properties CRUD handlers against real Postgres.
// Only the session-cookie verification is mocked (it needs a live Firebase
// cookie); everything below requireSession — user provisioning, owner
// scoping, validation, persistence — is real.

const sessionState: { current: SessionClaims | null } = { current: null };

vi.mock('@/lib/server/auth/session', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/server/auth/session')>();
  return {
    ...original,
    requireSession: vi.fn(async () => {
      if (!sessionState.current) throw new original.AuthError('UNAUTHENTICATED', 401);
      return sessionState.current;
    }),
  };
});

// vi.mock is hoisted above these imports, so the routes see the mocked session.
import { GET as listGet, POST as createPost } from '@/app/api/properties/route';
import {
  GET as itemGet,
  PATCH as itemPatch,
  DELETE as itemDelete,
} from '@/app/api/properties/[id]/route';

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;

const ownerClaims: SessionClaims = {
  uid: `fb-${stamp}-owner`,
  role: 'customer',
  verified: false,
  email: `owner-${stamp}@test.local`,
};
const strangerClaims: SessionClaims = {
  uid: `fb-${stamp}-stranger`,
  role: 'customer',
  verified: false,
  email: `stranger-${stamp}@test.local`,
};

function jsonRequest(method: string, body?: unknown): Request {
  return new Request('http://test.local/api/properties', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  sessionState.current = ownerClaims;
});

afterAll(async () => {
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('properties API', () => {
  it('401s without a session', async () => {
    sessionState.current = null;
    const res = await listGet();
    expect(res.status).toBe(401);
  });

  it('provisions the Postgres user on first use and creates a checklisted property', async () => {
    const res = await createPost(
      jsonRequest('POST', {
        label: 'Apartman test',
        type: 'vacation_rental',
        citySlug: 'sarajevo',
        street: 'Sarači',
        houseNo: '5',
        sizeM2: 48,
        rooms: 2,
        bathrooms: 1,
        isAirbnb: true,
        checklist: { linens: true, restock: ['kafa', 'voda'], damageReport: true },
      }),
    );
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.property.city.slug).toBe('sarajevo');
    expect(data.property.checklist.restock).toEqual(['kafa', 'voda']);

    // The user row was provisioned from the session claims.
    const owner = await prisma.user.findUnique({ where: { firebaseUid: ownerClaims.uid } });
    expect(owner?.email).toBe(ownerClaims.email);
  });

  it('lists only the caller’s properties', async () => {
    sessionState.current = strangerClaims;
    await createPost(jsonRequest('POST', { label: 'Tuđi stan', type: 'apartment' }));
    const strangers = await (await listGet()).json();
    expect(strangers.data.properties).toHaveLength(1);

    sessionState.current = ownerClaims;
    const owners = await (await listGet()).json();
    expect(owners.data.properties.map((p: { label: string }) => p.label)).not.toContain('Tuđi stan');
  });

  it('owner-scopes item access — foreign ids 404', async () => {
    const created = await (
      await createPost(jsonRequest('POST', { label: 'Scoped', type: 'apartment' }))
    ).json();
    const id = created.data.property.id;

    sessionState.current = strangerClaims;
    const asStranger = await itemGet(jsonRequest('GET'), { params: { id } });
    expect(asStranger.status).toBe(404);
    const patchAsStranger = await itemPatch(jsonRequest('PATCH', { label: 'Hacked' }), {
      params: { id },
    });
    expect(patchAsStranger.status).toBe(404);

    sessionState.current = ownerClaims;
    const asOwner = await itemGet(jsonRequest('GET'), { params: { id } });
    expect(asOwner.status).toBe(200);
  });

  it('patches partially and validates input', async () => {
    const created = await (
      await createPost(jsonRequest('POST', { label: 'Patchme', type: 'apartment', sizeM2: 50 }))
    ).json();
    const id = created.data.property.id;

    const patched = await itemPatch(jsonRequest('PATCH', { sizeM2: 75, hasElevator: true }), {
      params: { id },
    });
    const { data } = await patched.json();
    expect(data.property.sizeM2).toBe(75);
    expect(data.property.hasElevator).toBe(true);
    expect(data.property.label).toBe('Patchme'); // untouched

    const bad = await itemPatch(jsonRequest('PATCH', { sizeM2: -4 }), { params: { id } });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe('VALIDATION_ERROR');

    const badCity = await itemPatch(jsonRequest('PATCH', { citySlug: 'atlantis' }), {
      params: { id },
    });
    expect(badCity.status).toBe(404);
  });

  it('deletes a property; a booked property returns 409 PROPERTY_IN_USE', async () => {
    const created = await (
      await createPost(jsonRequest('POST', { label: 'Deleteme', type: 'apartment' }))
    ).json();
    const id = created.data.property.id;
    const del = await itemDelete(jsonRequest('DELETE'), { params: { id } });
    expect(del.status).toBe(200);
    expect(await prisma.property.findUnique({ where: { id } })).toBeNull();

    // Booked property: build the minimal graph, then attempt delete.
    const booked = await (
      await createPost(jsonRequest('POST', { label: 'Booked', type: 'apartment' }))
    ).json();
    const bookedId = booked.data.property.id;
    const owner = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: ownerClaims.uid } });
    const serviceType = await prisma.serviceType.findFirstOrThrow({ where: { key: 'standard' } });
    await prisma.booking.create({
      data: {
        code: `TT-${stamp}-block`,
        customerId: owner.id,
        propertyId: bookedId,
        serviceTypeId: serviceType.id,
        scheduledAt: new Date(),
        slotMinutes: 120,
        estHours: 2,
        cleanerRateF: 1000,
        cleanerAmountF: 2000,
        serviceFeeF: 400,
        cashFeeF: 0,
        discountF: 0,
        totalF: 2400,
        paymentMethod: 'card',
        pricingSnapshot: {},
        pricingConfigVersion: 1,
        matchingMode: 'direct',
        engagementModel: 'marketplace',
      },
    });
    const blocked = await itemDelete(jsonRequest('DELETE'), { params: { id: bookedId } });
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).error.code).toBe('PROPERTY_IN_USE');

    await prisma.booking.delete({ where: { code: `TT-${stamp}-block` } });
  });
});
