# Tech debt

Pre-existing issues found during cleanup work, not blocking the current cycle.
Each entry: title, where, when found, fix sketch.

---

## TD-01 — `closeCardModal` calls `history.replaceState` inside a state updater

- **Where:** `app/_components/RetroApp.tsx` (the `closeCardModal` `useCallback`)
- **Found:** 2026-05-01, while browser-verifying F-15-RM
- **Symptom:** React 19 strict-mode warning *"Cannot update a component (`Router`) while rendering a different component (`RetroAppLoaded`)"*. Console-only; no functional impact.
- **Cause:** Side effect (`history.replaceState`, focus restore) runs inside the `setOpenCardId((prev) => …)` updater. React 19 enforces purity on state updaters more strictly than React 18; updaters can be invoked during render checks.
- **Fix sketch:** Move the side effects outside the updater. Either depend on `openCardId` in the `useCallback` and early-return when null, or set a local "did close" flag in the updater and run side effects after. `openCardModal` already uses the correct pattern — the side effect lives outside the setState call.
- **Scope:** Single function, ~5 lines. Belongs in a polish/cleanup PR.
