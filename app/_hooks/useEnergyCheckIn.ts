"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type EnergyLevel = 1 | 2 | 3 | 4 | 5;

export type EnergyResult = {
  distribution: number[];
};

export type EnergySnapshot = {
  count: number;
  total: number;
  mine: EnergyLevel | null;
  revealed: boolean;
  result: EnergyResult | null;
};

export type EnergyCheckIn = EnergySnapshot & {
  vote: (level: EnergyLevel) => Promise<void>;
  reveal: (force?: boolean) => Promise<boolean>;
};

// Matches the board poll rather than the 5s presence poll: the tally is the
// live feedback that makes people actually cast a vote, so it has to feel
// immediate. It cannot ride on the board GET — that 304-short-circuits on an
// unchanged board, and the check-in deliberately lives outside the document.
const POLL_MS = 1500;

const EMPTY: EnergySnapshot = {
  count: 0,
  total: 0,
  mine: null,
  revealed: false,
  result: null,
};

function isVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

export function useEnergyCheckIn(
  boardId: string | undefined,
  enabled: boolean,
): EnergyCheckIn {
  const [snap, setSnap] = useState<EnergySnapshot>(EMPTY);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!boardId || !enabled) return;
    cancelled.current = false;

    const tick = async () => {
      if (!isVisible()) return;
      try {
        const res = await fetch(
          `/api/boards/${encodeURIComponent(boardId)}/energy`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as EnergySnapshot;
        if (!cancelled.current) setSnap(data);
      } catch {
        // transient network blip — next tick retries
      }
    };

    void tick();
    const handle = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled.current = true;
      window.clearInterval(handle);
    };
  }, [boardId, enabled]);

  const post = useCallback(
    async (body: Record<string, unknown>): Promise<boolean> => {
      if (!boardId) return false;
      try {
        const res = await fetch(
          `/api/boards/${encodeURIComponent(boardId)}/energy`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
          },
        );
        if (!res.ok) return false;
        const data = (await res.json()) as EnergySnapshot;
        // Adopt the response rather than waiting for the next tick, so your
        // own vote registers instantly instead of up to 1.5s later.
        if (!cancelled.current) setSnap(data);
        return true;
      } catch {
        return false;
      }
    },
    [boardId],
  );

  const vote = useCallback(
    async (level: EnergyLevel) => {
      await post({ level });
    },
    [post],
  );

  const reveal = useCallback(
    (force = false) => post({ action: "reveal", force }),
    [post],
  );

  return { ...snap, vote, reveal };
}
