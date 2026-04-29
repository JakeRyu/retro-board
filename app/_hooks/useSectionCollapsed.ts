"use client";

import { useCallback, useEffect, useState } from "react";

// Persist boards-list section collapse state per section name.
// Separate key from the main store so the F-01 schema isn't polluted by UI prefs.
const STORAGE_KEY = "retro-board:section-collapse:v1";

type CollapseMap = Record<string, boolean>;

function readMap(): CollapseMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as CollapseMap;
  } catch {
    // ignore corrupt payload
  }
  return {};
}

function writeMap(map: CollapseMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / privacy mode
  }
}

export function useSectionCollapsed(
  section: string,
  defaultCollapsed: boolean,
): [boolean, () => void] {
  // SSR + first-paint use the default; localStorage read happens post-mount
  // so the hydrated HTML matches.
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    const map = readMap();
    if (section in map) setCollapsed(map[section]);
  }, [section]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      const map = readMap();
      map[section] = next;
      writeMap(map);
      return next;
    });
  }, [section]);

  return [collapsed, toggle];
}
