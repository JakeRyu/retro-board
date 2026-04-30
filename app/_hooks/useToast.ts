"use client";

import { useEffect, useRef, useState } from "react";

// F-22: tiny module-level pub/sub so any component on any page can fire a
// toast — including just before a `router.push` that would unmount its caller.
// The toast host lives in <Sidebar>, which is mounted on every page, so a
// toast survives the navigation. Mirrors the `useCreateBoardDialog` pattern
// from F-03 to avoid prop-drilling toast plumbing through RetroApp/BoardsPage.

export type Toast = {
  // Monotonic id so the renderer keys off changes even when the same message
  // re-fires (e.g. two archives in a row).
  id: number;
  message: string;
  undo?: () => void;
};

type Listener = (toast: Toast) => void;

const listeners = new Set<Listener>();
let nextId = 1;

export function fireToast(message: string, undo?: () => void): void {
  const toast: Toast = { id: nextId++, message, undo };
  for (const l of listeners) l(toast);
}

// Hosted by <Sidebar>. Manages the single visible toast + its 6s/2.4s timer.
// Plain toasts hold for 2.4s; toasts with undo hold for 6s per F-22 §3.
export function useToastHost() {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler: Listener = (next) => {
      if (timer.current) clearTimeout(timer.current);
      setToast(next);
      const lifetime = next.undo ? 6000 : 2400;
      timer.current = setTimeout(() => setToast(null), lifetime);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const dismiss = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  };

  return { toast, dismiss };
}
