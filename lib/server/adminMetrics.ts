import 'server-only';
import { prisma } from '@/lib/server/db';

// Dashboard metrics (E9.2, §8 admin: bookings, GMV, commission, active
// cleaners, conversion). One aggregate round-trip per number; money stays
// integer fenings and is formatted at the edge.

export interface DashboardMetrics {
  since: Date;
  bookingsCreated: number;
  bookingsCompleted: number;
  bookingsCancelled: number;
  bookingsOpen: number; // matching..pending_completion
  gmvF: number; // Σ total_f of completed bookings in window
  commissionF: number; // Σ service_fee_f (+cash fee) of completed bookings
  conversionPct: number | null; // completed / created, null when no creations
  activeCleaners: number;
  verifiedCleaners: number;
  disputesOpen: number;
}

const OPEN_STATUSES = ['matching', 'accepted', 'on_my_way', 'in_progress', 'pending_completion'] as const;

export async function dashboardMetrics(windowDays = 30, now = new Date()): Promise<DashboardMetrics> {
  const since = new Date(now.getTime() - windowDays * 86_400_000);

  const [created, completedAgg, cancelled, open, cleaners, verified, disputesOpen] =
    await Promise.all([
      prisma.booking.count({ where: { createdAt: { gte: since } } }),
      prisma.booking.aggregate({
        where: { status: 'completed', updatedAt: { gte: since } },
        _count: true,
        _sum: { totalF: true, serviceFeeF: true, cashFeeF: true },
      }),
      prisma.booking.count({ where: { status: 'cancelled', updatedAt: { gte: since } } }),
      prisma.booking.count({ where: { status: { in: [...OPEN_STATUSES] } } }),
      prisma.cleanerProfile.count({ where: { active: true, user: { status: 'active' } } }),
      prisma.cleanerProfile.count({
        where: { active: true, tier: 'verified', user: { status: 'active' } },
      }),
      prisma.dispute.count({ where: { status: { in: ['open', 'investigating'] } } }),
    ]);

  const completed = completedAgg._count;
  return {
    since,
    bookingsCreated: created,
    bookingsCompleted: completed,
    bookingsCancelled: cancelled,
    bookingsOpen: open,
    gmvF: completedAgg._sum.totalF ?? 0,
    commissionF: (completedAgg._sum.serviceFeeF ?? 0) + (completedAgg._sum.cashFeeF ?? 0),
    conversionPct: created === 0 ? null : Math.round((completed / created) * 100),
    activeCleaners: cleaners,
    verifiedCleaners: verified,
    disputesOpen,
  };
}
