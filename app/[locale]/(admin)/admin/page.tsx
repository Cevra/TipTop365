import { requireRole } from '@/lib/server/auth/session';

// Placeholder admin landing. The (admin) route group is gated at the edge
// (middleware, /admin prefix) and again here server-side by role. The full
// back-office is built in E9.
export default async function AdminHome() {
  const session = await requireRole('admin');
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold text-primary-500">Admin</h1>
      <p className="mt-2 text-gray-600">
        Back-office scaffold. Signed in as <code>{session.uid}</code>. Modules land in E9.
      </p>
    </div>
  );
}
