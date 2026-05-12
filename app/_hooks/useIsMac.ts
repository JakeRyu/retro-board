"use client";

import { useEffect, useState } from "react";

// Returns true on macOS, false everywhere else. Defaults to `false` on SSR
// and the first client render so the hydration markup matches; resolves to
// the real value in a post-mount effect.
export function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent;
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(ua));
  }, []);
  return isMac;
}
