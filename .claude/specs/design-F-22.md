# F-22 — Undo on destructive actions

## 1. Feature recap

Trello-style "delete confirm" is not a substitute for undo: confirms slow you down on every click and still don't help when you confirmed by mistake. F-22 attaches an `Undo` affordance to the toast that already fires on the four destructive flows that landed in F-14 / F-05 / F-17, and gives each one enough state-snapshot to fully restore the prior shape. **Card delete-forever (F-14 archive panel) is deliberately excluded** — that path's whole point is "this can't be undone," which is why it lives behind a solid-red confirm.

## 2. Surfaces & flows

| Action | Trigger today | Toast today | F-22 change |
|---|---|---|---|
| Card archive | `<Card>` kebab `Archive` and modal sidebar `Archive card` | `Card archived.` | Append `Undo` → `unarchiveCard(boardId, cardId)`. |
| Column delete | Column kebab `Delete` (empty: silent; non-empty: confirm modal `Delete`) | none today | Add toast `Column deleted.` + `Undo` → re-insert column at original index. |
| Board archive | Settings menu → `Archive board` → confirm modal `Archive` (then navigates to `/`) | none — navigation is the feedback | Add toast `Board archived.` on the boards-list page + `Undo` → clear `archivedAt` and navigate back to `/boards/<id>`. |
| Card delete-forever | Modal sidebar / archive-panel row `Delete forever` confirm | `Card deleted.` | **No undo.** Locked at design — this is the irreversible escape hatch by contract. |

## 3. Toast format

Existing pill toast (`.toast`, fixed bottom-center, `--bg-surface` chip with shadow) is extended:

- Message text on the left, identical voice/punctuation.
- When undo is present: a small `Undo` text-link button after a thin `·` separator. Class `.toast-undo`. Color `var(--accent)`, hover `var(--accent-hi)`, font 12px / 600. No border, no background — it reads as an action link inside the chip, in line with the Linear-mood rule "indigo for primary action."
- Lifetime extended from current 2400ms to **6000ms** when undo is present (per backlog AC). Plain toasts keep 2400ms — the 6s hold is the cost of giving people time to react, and we only pay it when there's something to react to.
- Once the toast expires (or is replaced), undo is gone. No history panel in v1.
- Only one undo at a time: firing a new toast (with or without undo) replaces the current one. Clicking `Undo` immediately runs the function and clears the toast.

## 4. State snapshots

Each action snapshots **before** mutating so undo restores byte-for-byte:

- **Card archive**: `archiveCard` already preserves the full card object inside `board.archivedCards`; undo just calls `unarchiveCard` which re-uses the existing path (origin column, all card fields, voters, labels, etc.). No new snapshot needed.
- **Column delete**: `deleteColumn` drops the column object outright. Snapshot the **column + its index in `board.columns`** in `RetroApp` *before* calling the store action. Undo re-inserts via a new `storeActions.insertColumn(boardId, column, index)` helper that takes a full `Column` object (not a title) and splices it back at `index`.
- **Board archive**: snapshot is just the `archivedAt` slot (effectively just "was archived? no.") plus the originating `boardId`. Undo calls `storeActions.unarchiveBoard(boardId)` and `router.push("/boards/<id>")` so the user lands back on the board they just archived. Recommendation: yes, navigate back — without it, undo only half-undoes the action (board reappears in Open list but the user has to re-find it).

## 5. Toast hosting

Today the toast lives inside `RetroApp`, scoped to a single board view. Board archive navigates to `/`, so the toast can't survive on the source page. Two options:

- **Local toasts on each page** + cross-page handoff via query param. Fragile, reinvents global state.
- **Module-level pub/sub toast hook** (recommended), mirroring `useCreateBoardDialog`'s pattern. A `fireToast(message, undo?)` function any component can call; a single host renders the chip. Host lives in `<Sidebar>` (already mounted on every page) so a toast fired right before `router.push("/")` survives the route change.

Going with the pub/sub hook. New file `app/_hooks/useToast.ts`:

```ts
type ToastPayload = { message: string; undo?: () => void };
export function fireToast(message: string, undo?: () => void) { /* notify listeners */ }
export function useToastHost() { /* returns { toast, dismiss } for the renderer */ }
```

`<Toast>` renderer extracted to `app/_components/Toast.tsx`. Hosted by `Sidebar` next to `CreateBoardDialog`. `RetroApp` and `BoardsPage` no longer own toast state.

## 6. Microcopy

- `Card archived. · Undo`
- `Card unarchived.` (no undo — non-destructive)
- `Card deleted.` (no undo — irreversible by contract)
- `Column deleted. · Undo`
- `Board archived. · Undo`
- `Board reopened.` / `Board unarchived.` (existing, unchanged)

The `·` is decorative spacing, not a button — it's a `<span aria-hidden>`. The `Undo` button has `aria-label="Undo"` and runs on Enter/Space when focused (native `<button>` semantics).

## 7. CSS additions

Existing `.toast` chip already uses `display: flex; gap: 8px;` so adding a child button is layout-neutral. New rules:

- `.toast .toast-sep` — `color: var(--fg4); font-size: 12px;` decorative dot.
- `.toast .toast-undo` — `background: none; border: 0; padding: 0; font: inherit; font-weight: 600; color: var(--accent); cursor: pointer;` and `:hover { color: var(--accent-hi); }`. No focus ring beyond the existing `:focus-visible` token.

No new color tokens. No new layout primitives.

## 8. Edge cases

- **Toast expires while user hovers**: pragmatic v1 — timer doesn't pause on hover. 6s is enough for a deliberate undo; pause-on-hover is a nice-to-have if telemetry shows misses.
- **Click `Undo` after a second destructive action replaced the toast**: not possible — replacing the toast unmounts the old button. The old undo function is dropped on the floor.
- **Board archive undo when the board id is gone (manually cleared from another tab)**: `unarchiveBoard` is already idempotent and no-ops on unknown ids; `router.push` lands on a "Board not found" page, which is acceptable. Not worth a try-catch.
- **Column delete undo after columns have been reordered**: `insertColumn` clamps `index` to `[0, columns.length]`, so the column comes back at the closest-to-original position. Cards inside it are intact (snapshotted with the column object).
- **Card archive undo for a card that was already unarchived in another tab**: `unarchiveCard` no-ops on unknown ids — silent, defensive.
- **Reduced-motion**: existing toast uses 200ms opacity/transform; no change needed.

## 9. Open questions for PO

- **Should `Card unarchived.` also have a `Re-archive` undo?** Argued no in this spec — unarchive isn't destructive. Easy to add later if the symmetry feels missing.
- **Toast pause-on-hover?** Deferred. Worth revisiting if 6s turns out to be tight.
