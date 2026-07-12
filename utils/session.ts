import type { User } from 'firebase/auth';

// Client-side bridge: after Firebase client sign-in, exchange the ID token for
// an httpOnly session cookie the server can verify (plan D4). Call on
// login/signup; call endSession() on logout.

export async function startSession(user: User): Promise<void> {
  const idToken = await user.getIdToken();
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    throw new Error(`Failed to establish session (${res.status})`);
  }
}

export async function endSession(): Promise<void> {
  await fetch('/api/auth/session', { method: 'DELETE' });
}
