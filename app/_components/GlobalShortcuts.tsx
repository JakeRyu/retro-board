"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  isShortcutsCheatSheetOpen,
  openShortcutsCheatSheet,
} from "./ShortcutsCheatSheet";
import { openSearchDialog } from "../_hooks/useSearchDialog";

// F-19 always-on shortcuts: `b` (boards) and `?` (cheat-sheet). Mounted
// once inside <Sidebar> so every page picks them up. Board-scoped keys
// (`c`, `/`) live in RetroApp where they have access to board state.

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function GlobalShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K opens search from anywhere — including inside text
      // fields, since that's the conventional behavior.
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        if (e.key === "k" || e.key === "K") {
          e.preventDefault();
          openSearchDialog(null);
          return;
        }
      }
      // Leave the rest of platform shortcuts alone. Shift is allowed since
      // `?` is typically Shift+/.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Don't fire while the user is typing.
      if (isEditableTarget(e.target)) return;
      // While the cheat-sheet is open, swallow other shortcuts; Esc is
      // owned by the modal itself.
      if (isShortcutsCheatSheetOpen()) return;

      if (e.key === "?") {
        e.preventDefault();
        openShortcutsCheatSheet();
        return;
      }
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        router.push("/");
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}
