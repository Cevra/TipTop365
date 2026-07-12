// Realtime channel contract (plan D3 v1.1). One polled endpoint replaces
// Firestore for chat / live location / status. Types are shared by the server
// route and the client hook; SSE/WebSocket can later implement the same shape.

export interface LiveLocation {
  lat: number;
  lng: number;
  at: string; // ISO timestamp
}

export interface LiveMessage {
  id: string;
  senderId: string;
  body: string;
  at: string; // ISO timestamp
}

export interface LiveSnapshot {
  bookingStatus: string | null;
  location: LiveLocation | null;
  messages: LiveMessage[];
  // Opaque cursor the client echoes back to fetch only newer messages.
  cursor: string | null;
}

// Suggested poll cadences (ms). The map view updates less often than chat.
export const POLL_INTERVAL_CHAT_MS = 4000;
export const POLL_INTERVAL_MAP_MS = 10000;

/**
 * Pure: how long to wait before the next poll. Returns null to PAUSE polling
 * while the tab is hidden (saves battery/quota; resumes on visibility). Kept
 * pure so the hook's cadence logic is unit-testable without a DOM.
 */
export function resolvePollInterval(baseMs: number, isVisible: boolean): number | null {
  return isVisible ? baseMs : null;
}
