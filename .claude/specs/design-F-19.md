# F-19 — Keyboard shortcuts (global + board)

## 1. Feature recap

Power users want to skip the mouse for the actions they hit constantly: jumping
to a board, focusing the add-card composer, opening the filter, getting back
to the boards list, and finding the cheat-sheet. F-19 wires four single-key
shortcuts on top of the existing surfaces and ships a cheat-sheet modal that
also documents the discussion-mode keys F-06 already shipped. Customisation is
explicitly out of v1.

## 2. Shortcuts

| Key | Scope             | Result                                                       |
|-----|-------------------|--------------------------------------------------------------|
| `c` | board page only   | open the first column's `Add a card` composer and focus it   |
| `/` | board page only   | open the Filter popover with focus in the search input       |
| `b` | anywhere          | `useRouter().push("/")` — back to the boards list            |
| `?` | anywhere          | open the shortcuts cheat-sheet modal                         |
| `Esc` | cheat-sheet modal | close the modal (existing modal-overlay click pattern stays) |

Existing keys, documented (not re-implemented):

- `←` / `→` in discussion mode — previous / next column (F-06, RetroApp).
- `Esc` in discussion mode — exit discussion (F-06, RetroApp).
- `Esc` in card details modal / filter popover / any modal — close (existing).
- `Ctrl/Cmd + ↑/↓/←/→` on a focused card — keyboard DnD move (F-06).
- `Ctrl/Cmd + Shift + ←/→` on a focused column header — column reorder (F-06).
- `Cmd/Ctrl + Enter` in comment composer — submit comment (F-13).

## 3. Suppression rules

The global handler returns early when:

- `document.activeElement` is `INPUT`, `TEXTAREA`, or `[contenteditable]`.
- The event has any modifier key (`Ctrl`/`Meta`/`Alt`) — leave platform
  shortcuts alone. (Shift is allowed: `?` is `Shift+/` on most layouts.)
- The cheat-sheet modal itself is open (any other shortcut would feel weird
  while the sheet is up).

`Esc` is the **only** key that always works regardless of focus, because it's
already handled by individual modals/popovers — the global handler doesn't
need to special-case it. We just don't intercept it.

## 4. Cheat-sheet modal

Reuses `.modal-overlay` + `.modal` classes — same pattern as the close-board
confirm. Width 460px (matches `.modal.modal-create`). Title: `Keyboard
shortcuts`.

Layout: vertically stacked groups, each with a small uppercase heading and a
two-column list (key on the left, description on the right):

```
┌─ Keyboard shortcuts ─────────────────────────┐
│ GLOBAL                                       │
│   ?            Show this cheat-sheet         │
│   b            Go to boards                  │
│ ON A BOARD                                   │
│   c            Add a card to the first col   │
│   /            Open filter                   │
│ DRAG & DROP                                  │
│   Ctrl ↑ / ↓   Move card within column       │
│   Ctrl ← / →   Move card across columns      │
│   Ctrl ⇧ ← / → Move column                   │
│ DISCUSSION MODE                              │
│   ← / →        Previous / next column        │
│   Esc          Exit discussion               │
│ IN A MODAL                                   │
│   Esc          Close                         │
│                                       [Close]│
└──────────────────────────────────────────────┘
```

Groups are flex columns with `gap: 14px`. Each row is a `display: grid;
grid-template-columns: 120px 1fr;` so keys align. Multi-key combos render
each token in its own `.kbd` pill separated by a thin space. Esc/overlay
click close the modal.

## 5. Plumbing

- A new client component `app/_components/ShortcutsCheatSheet.tsx` renders
  the modal and listens to a tiny module-level pub/sub (mirrors
  `useCreateBoardDialog.ts`). Any caller — in this feature, just the global
  shortcut handler — calls `openShortcutsCheatSheet()`. The host mounts once
  inside `<Sidebar>` so it's always in the tree.
- A new client component `app/_components/GlobalShortcuts.tsx` mounts the
  always-on `b` and `?` handlers via a single `keydown` listener on `window`.
  Lives inside `<Sidebar>` so every page picks it up. Uses `useRouter()` for
  `b`.
- Board-scoped `c` and `/` are handled by an effect inside `RetroAppLoaded`
  (next to the existing discussion-mode key effect). Filter open is wired by
  flipping the existing `filterOpen` state; `c` is wired by triggering the
  first column's add-card composer.
- For `c`, the simplest seam is a module-level pub/sub identical to
  `useCreateBoardDialog`: `requestAddCard(colId)`. The first column's
  `<Column>` subscribes; on a matching id it sets `adding=true`. The existing
  `useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])`
  already handles the focus step.

  This avoids adding refs / imperative handles to `Column.tsx` for one
  shortcut. The same hook can later serve other "focus this composer" needs
  (e.g. F-16 empty-board hint nudge).

## 6. States and edge cases

- **Cheat-sheet open + another shortcut pressed** — handler returns early
  (rule from §3); Esc closes the sheet.
- **`/` while filter is hidden (discussion mode)** — handler is no-op. The
  filter button itself is unmounted.
- **`/` while popover is already open** — handler is no-op; the input is
  already focused.
- **`c` on a board with zero columns** — handler is no-op (nothing to focus).
- **`c` on a closed/read-only board** — `Add a card` button doesn't render,
  so `requestAddCard` finds no subscriber and the publish is a no-op. No
  toast.
- **`b` on the boards list page** — `router.push("/")` is a no-op; harmless.
- **Native `?` on Firefox quick-find** — Firefox's "Quick Find (Links Only)"
  triggers on `'` and `/`. We intercept `/` only on board pages and call
  `e.preventDefault()` so the Find bar doesn't appear. `?` is not bound by
  Firefox.
- **Server-rendered first paint** — handlers attach in `useEffect`, never
  during SSR. Safe.

## 7. Microcopy

- Cheat-sheet title: `Keyboard shortcuts`.
- Cheat-sheet group headings: `Global`, `On a board`, `Drag & drop`,
  `Discussion mode`, `In a modal`. Uppercase via CSS, not raw caps.
- Close button label: `Close`.
- No toasts on shortcut firing — the visible state change is the feedback.

## 8. CSS — new classes

Reuses `.modal-overlay`, `.modal`, `.kbd`, `.btn` styles. New rules:

- `.modal.modal-cheat-sheet` — `width: 460px;` (or just inherit; only here so
  later tweaks have a hook).
- `.cheat-sheet` — `display: flex; flex-direction: column; gap: 14px;
  margin-bottom: 16px;`.
- `.cheat-group-heading` — `font-size: 10px; font-weight: 600;
  letter-spacing: 0.6px; text-transform: uppercase; color: var(--fg4);
  margin-bottom: 6px;`.
- `.cheat-row` — `display: grid; grid-template-columns: 120px 1fr;
  align-items: center; gap: 12px; padding: 4px 0; font-size: 13px;
  color: var(--fg2);`.
- `.cheat-key` — flex container for one or more `.kbd` pills; `gap: 4px;
  display: inline-flex; align-items: center;`.

No new tokens. No new colors.

## 9. Open questions / punted

1. Customisation — explicitly out of v1.
2. A mouse entry-point for the cheat-sheet (small `?` button somewhere in
   the chrome) — keyboard-only is fine for v1; flag for follow-up if
   discoverability becomes a problem.
3. `n` / `Cmd+N` for "new card / new board" — not in backlog; skip.
