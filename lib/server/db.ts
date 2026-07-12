import { PrismaClient } from '@prisma/client';

// Singleton: Next.js dev hot-reload re-evaluates modules; without the global
// cache every reload would open a new connection pool against Neon.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
