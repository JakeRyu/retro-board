"use client";

import { useEffect, useState } from "react";

export type PresenceUser = { id: string; name: string };

// Slow poll for who-is-here. The heartbeat itself is the existing 1.5s
// board GET — see lib/presence.ts. This hook just reads the snapshot.
const POLL_MS = 5000;

function isVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

export function usePresencePolling(boardId: string | undefined): PresenceUser[] {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!boardId) return;
    let cancelled = false;

    const tick = async () => {
      if (!isVisible()) return;
      try {
        const res = await fetch(
          `/api/boards/${encodeURIComponent(boardId)}/presence`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as PresenceUser[];
        if (!cancelled) setUsers(data);
      } catch {
        // transient network blip — next tick retries
      }
    };

    void tick();
    const handle = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [boardId]);

  return users;
}
