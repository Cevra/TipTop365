import 'server-only';
import type { User } from '@prisma/client';
import { prisma } from '@/lib/server/db';
import { ApiError } from '@/lib/server/http';
import { FLAGS_BEFORE_ADMIN_REVIEW, maskContacts } from '@/lib/domain/chatMasking';
import { audit } from '@/lib/server/audit';

// Booking chat (E4.5, §12.4). Chat opens once a cleaner is attached and stays
// open through the dispute window — never before acceptance (contact stays
// masked pre-booking by simply not existing).
const CHAT_OPEN_STATUSES = [
  'accepted',
  'on_my_way',
  'in_progress',
  'pending_completion',
  'disputed',
] as const;

export async function requireChatParty(bookingId: string, user: User) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { cleaner: { select: { userId: true } } },
  });
  if (!booking) throw new ApiError('BOOKING_NOT_FOUND', 404);
  const isCustomer = booking.customerId === user.id;
  const isCleaner = booking.cleaner?.userId === user.id;
  if (!isCustomer && !isCleaner) throw new ApiError('BOOKING_NOT_FOUND', 404); // no existence oracle
  return { booking, isCustomer };
}

export async function sendChatMessage(args: { bookingId: string; sender: User; body: string }) {
  const { booking } = await requireChatParty(args.bookingId, args.sender);
  if (!(CHAT_OPEN_STATUSES as readonly string[]).includes(booking.status)) {
    throw new ApiError('CHAT_CLOSED', 409, { status: booking.status });
  }

  const result = maskContacts(args.body);
  const message = await prisma.chatMessage.create({
    data: {
      bookingId: booking.id,
      senderId: args.sender.id,
      body: result.masked,
      flagged: result.flagged,
      flagReason: result.flagReason,
    },
  });

  // §12.4: 3 flags → admin review. Audited once, exactly at the threshold,
  // plus an outbox notification so E10's dispatcher can page the admins.
  if (result.flagged) {
    const flaggedCount = await prisma.chatMessage.count({
      where: { bookingId: booking.id, senderId: args.sender.id, flagged: true },
    });
    if (flaggedCount === FLAGS_BEFORE_ADMIN_REVIEW) {
      await audit({
        actorUserId: args.sender.id,
        action: 'chat.flag_threshold_reached',
        entityType: 'booking',
        entityId: booking.id,
        after: { flaggedCount, lastReason: result.flagReason },
      });
      const admins = await prisma.user.findMany({ where: { role: 'admin', status: 'active' } });
      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            bookingId: booking.id,
            eventKey: 'chat.flag_threshold_reached',
            channel: 'email' as const,
            payload: { bookingCode: booking.code, senderId: args.sender.id, flaggedCount },
          })),
        });
      }
    }
  }

  return { message, wasMasked: result.flagged };
}

/** Messages after `cursor` (a message id), oldest-first, capped. */
export async function chatMessagesSince(bookingId: string, cursor: string | null, take = 50) {
  const after = cursor
    ? await prisma.chatMessage.findUnique({ where: { id: cursor }, select: { createdAt: true } })
    : null;
  return prisma.chatMessage.findMany({
    where: {
      bookingId,
      ...(after ? { createdAt: { gt: after.createdAt } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take,
  });
}
