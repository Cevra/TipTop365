import 'server-only';
import { prisma } from '@/lib/server/db';
import { adminAuth } from '@/lib/server/firebaseAdmin';

// Right-to-delete (E12.2, §8.5): anonymize, don't destroy. Personal data is
// scrubbed; bookings, ledger entries and contracts stay PSEUDONYMIZED for the
// statutory retention the plan requires — the row loses its person, not its
// accounting. Photos are queued for the E12.1 retention job (binaries) by
// zeroing delete_after.

export interface AnonymizeResult {
  userId: string;
  scrubbedProperties: number;
  maskedMessages: number;
  queuedPhotos: number;
  firebaseDeleted: boolean;
}

export async function anonymizeUser(userId: string): Promise<AnonymizeResult> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const result = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@anonymized.tiptop365.ba`,
        firebaseUid: `deleted:${userId}`,
        firstName: null,
        lastName: null,
        phone: null,
        referralCode: null,
        status: 'deleted',
      },
    });

    const properties = await tx.property.updateMany({
      where: { ownerId: userId },
      data: {
        label: null,
        street: null,
        houseNo: null,
        floor: null,
        accessNotes: null,
        checklist: undefined,
        lat: null,
        lng: null,
      },
    });

    await tx.cleanerProfile.updateMany({
      where: { userId },
      data: { bio: null, photoUrl: null, availability: undefined, active: false, lat: null, lng: null },
    });
    await tx.cleanerLegalProfile.updateMany({
      where: { cleanerId: userId },
      data: {
        studentProofUrl: null,
        obrtIdNumber: null,
        jmbgEncrypted: null,
        bankAccountIban: null,
      },
    });

    const messages = await tx.chatMessage.updateMany({
      where: { senderId: userId },
      data: { body: '▮▮▮ (obrisano na zahtjev korisnika)' },
    });

    // Binaries die at the next E12.1 retention sweep.
    const photos = await tx.photo.updateMany({
      where: { uploadedById: userId, deletedAt: null },
      data: { deleteAfter: new Date(0), deleteReason: 'gdpr:right_to_delete' },
    });

    return {
      scrubbedProperties: properties.count,
      maskedMessages: messages.count,
      queuedPhotos: photos.count,
    };
  });

  // Best-effort: the Firebase account may already be gone or creds absent
  // (CI). The Postgres scrub above is the compliance-relevant part.
  let firebaseDeleted = false;
  try {
    await adminAuth().deleteUser(user.firebaseUid);
    firebaseDeleted = true;
  } catch {
    firebaseDeleted = false;
  }

  return { userId, ...result, firebaseDeleted };
}
