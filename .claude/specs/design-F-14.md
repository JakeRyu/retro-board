# F-14 — Card archive (and unarchive)

## 1. Feature recap

Today the card kebab on a live card has two items: `Edit` and `Delete`. Delete is a hard-irreversible wipe, which is the wrong default — Trello's archive pattern (soft-hide + recoverable) is what users expect. F-14 ships archive as the new lightweight remove-from-view, demotes the existing hard delete to "Delete forever" inside an archive panel, and gives the modal sidebar `.cd-side-archive` slot (already shipped empty in F-07) its real content. F-17 will later move the archive entry point into a board settings menu; F-22 will add Undo to the archive toast. F-14 wires both touchpoints so those follow-ups slot in.

## 2. Model

`Card.archivedAt?: string` — already typed by F-01 (ISO timestamp).

**New on `Card`:** `originColumnId?: string` — id of the column the card lived in at the moment of archive. Used by `unarchiveCard` to send it home; falls back to "first column, top" if the column is gone.

**New on `Board`:** `archivedCards: Card[]` — board-level bucket. Archived cards leave their column's `cards[]` and live here, each carrying their own `archivedAt` and `originColumnId`. Recommended over an `archived: true` flag on cards in their column because every column iteration in the codebase (`col.cards.map`, `col.cards.filter`, dnd ids, vote counts, sort-by-votes, retro discussion mode) would otherwise have to learn to skip archived cards. Bucket-out keeps existing column code paths zero-changed.

**Migration (in `migrateBoard` in `store.ts`):**

- If `b.archivedCards` is missing, set it to `[]`.
- Sweep `b.columns[*].cards` for any card with `archivedAt` set; remove from its column and append to `b.archivedCards`, stamping `originColumnId` to that column's id if not already set.

This keeps any pre-F-14 payload self-healing on next hydrate.

## 3. Card kebab (live cards)

`Card.tsx` kebab loses `Delete` and gains `Archive`. Final menu items, in order:

1. **Edit card** (existing).
2. **Archive** — new. Icon `inbox` (closest existing semantic; reuse to avoid bloating `Primitives.tsx`). No `.danger` class — archive is *not* destructive.

The `onDelete` prop on `<Card>` / `<CardView>` is renamed to `onArchive` end-to-end (Card → Column → RetroApp), and the `Card.tsx` kebab calls it. The "Delete forever" affordance only exists in the archive panel.

## 4. Modal sidebar `.cd-side-archive`

The slot exists empty from F-07. F-14 fills it with one of two states, decided by `card.archivedAt`:

**Live card (`!archivedAt`):**

- Section heading `Actions` (already in the F-07 placeholder).
- One full-width button: `Archive card`. Class `cd-side-action btn-ghost danger-tone` — `.btn-ghost` base, with a `--danger-tone` modifier that tints text `--danger` and hover background `rgba(217,119,119,0.08)`. *Not* `.btn-danger` (solid red is reserved for irreversible). Icon `inbox`.

**Archived card (`archivedAt` set):**

- Two stacked full-width buttons:
  - `Unarchive card` — `cd-side-action btn-ghost`, neutral.
  - `Delete forever` — `cd-side-action btn-ghost danger-tone`. Opens the permanent-delete confirm modal.
- Heading switches to `Archived` and a small `--fg4 / 11px` line under it: `Archived <relative time>` using `formatRelativeTime(archivedAt)`.

Read-only / closed board: all buttons render `disabled`. The whole slot stays visible so the user can still read state.

## 5. Archive flow

- Trigger: kebab `Archive` on a live card, **or** modal sidebar `Archive card` button.
- Action: `storeActions.archiveCard(boardId, cardId)`.
  - Find the card in `board.columns[*].cards`. If not present, no-op.
  - Stamp `archivedAt = new Date().toISOString()`, `originColumnId = <containing column id>`.
  - Remove from that column's `cards`. Append to `board.archivedCards`.
- UI feedback: existing `fireToast("Card archived.")` from `RetroApp`. **No confirm modal** — archive is reversible. F-22 will add an Undo button to the toast; F-14 ships the bare toast.
- If the modal was open on this card when archived from the sidebar: leave it open. The modal flips to its archived state (per §4) automatically because the card object now carries `archivedAt`. The archived card lookup in `RetroApp.openCard` must search both `columns` and `archivedCards` (see §8 plumbing).

## 6. Permanent delete flow

- Trigger: `Delete forever` on an archive-panel row, **or** modal sidebar `Delete forever` (when card is archived).
- Confirm modal (full-screen, reuses `.modal-overlay` + `.modal` family):
  - Title: `Delete this card forever?`
  - Body: `This can't be undone.`
  - Actions: `Cancel` (`.btn-ghost`), `Delete forever` (`.btn-danger`).
- On confirm: `storeActions.deleteCardForever(boardId, cardId)` — drops the card from `board.archivedCards` only. Defensive: if the id is somehow still in a column, leave it (deleteCardForever is archived-only by contract). Toast: `Card deleted.`
- If the modal sidebar triggered the delete and the card detail modal is open: close the detail modal after confirm (the card no longer exists; same self-heal that already runs in `RetroApp` when an open card disappears).

## 7. Unarchive flow

- Trigger: archive panel row `Unarchive`, **or** modal sidebar `Unarchive card`.
- Action: `storeActions.unarchiveCard(boardId, cardId)`.
  - Pull the card from `board.archivedCards`.
  - Resolve target column: `board.columns.find(c => c.id === card.originColumnId)`. Fallback: `board.columns[0]`.
  - Insert at index 0 (top) of that column. Per backlog AC: "returns to last column position if it still exists, else to first column" — "position" here is interpreted as *column*, not row index. Restoring exact row position is gold-plate (F-22 Undo will get a closer restore via prior-state snapshot anyway).
  - Clear `archivedAt` and `originColumnId`.
- Toast: `Card unarchived.`

## 8. Plumbing for the open card

`RetroApp.findCard` and the hash-driven open path currently scan only `board.columns`. They must additionally scan `board.archivedCards` so the modal can stay open across an archive action and so a `#card=<id>` link to an archived card resolves into its archived-state modal. The "exists?" guards (modal mount, hash-strip on stale id) likewise widen.

## 9. Archive panel

### Where it lives in F-14

Per backlog F-17 will surface the archive panel from the board settings menu. F-14 ships it as a self-contained `<ArchivedItemsPanel />` component with a temporary entry point: a small **`View archived (N)`** link rendered at the bottom of the board area (just above the board's bottom padding) inside `RetroApp.tsx`. Hidden when `N === 0` — empty archive deserves no entry point. F-17 will remove this temp link and route the panel from the settings menu instead.

Visually: `--fg4 / 12px / 510`, left-aligned with the board-area padding, shows a small inbox icon. Hover lifts color to `--fg2`. No border/background — just text. Class: `archived-link`.

### Panel chrome — overlay sliding from the right

Recommended over an inline section because (a) the archive can hold many rows; (b) it's a side-quest, not on the primary path; (c) it gives F-17 a clean re-entry from a settings menu without rearranging the board layout.

```
┌─ .archive-panel-overlay ───────────────┐
│                          ┌─ .archive-panel ───┐
│                          │  Archived items   ✕│
│                          │  ─────────────────  │
│                          │  ┌─ .archive-row ─┐ │
│                          │  │ [stripes]      │ │
│                          │  │ Card title…    │ │
│                          │  │ in <col> · 3h  │ │
│                          │  │ [Unarchive][Del]│ │
│                          │  └────────────────┘ │
│                          │  ...                │
│                          └────────────────────┘
└────────────────────────────────────────┘
```

- Overlay: same `.modal-overlay` token (background `--overlay`, fade 150ms) but the inner panel anchors right and slides in from `translateX(20px) → 0` over 180ms.
- Panel width: `420px`, `max-width: 92vw`, full height (`top: 0; bottom: 0`), background `--bg-surface`, `border-left: 1px solid var(--border-standard)`.
- Header row: title `Archived items` (16px / 590), close button (top-right, reuses `.btn-icon`).
- Esc closes. Overlay click closes (same pointerdown-vs-click distinction as F-07).
- Body scrolls vertically (`overflow-y: auto`). Empty state copy: `Nothing archived yet.` muted `--fg4 / 13px`, centered.

### Row content

Each row in the panel:

- Label stripes (reuse `<LabelStripes>`) at the top — same pattern as the card preview, gives quick recognition.
- Card title (one line, `text-overflow: ellipsis`, `--fg1 / 13px / 510`).
- Sub-line (`--fg4 / 11px`): `in <originColumnTitle> · <relative archive time>`. If the origin column is gone, render `in <deleted column> · <relative time>`.
- Inline actions (right-aligned): `Unarchive` (`.btn-toolbar`), `Delete forever` (`.btn-toolbar danger-tone`). The danger-tone modifier on `.btn-toolbar` mirrors the modal-sidebar variant (text `--danger`, hover bg `rgba(217,119,119,0.08)`).

Rows are listed in `archivedAt` descending order (most-recently-archived first).

Grouping by original column: the F-14 backlog AC reads "list of archived cards grouped by their original column". Pragmatic interpretation: render rows with the column name in the sub-line (so each row tells you where it came from), but **flat-listed and sorted by recency**. A grouped accordion is more chrome than this surface deserves at the size archives actually grow to in single-user v1; if archives ever exceed ~50 rows we can group then. PO can override.

### Read-only / closed board

Panel is viewable. Both action buttons on each row render `disabled`. Header `Archived items` plus a small banner under it: `This board is closed — archive is read-only.` (`--fg4 / 12px`).

## 10. CSS — new classes

All new, all justified:

- `.archived-link` — temp entry point above board-area bottom edge. Text-only; `--fg4 / 12px / 510`, hover `--fg2`. Removed in F-17.
- `.archive-panel-overlay` — variant on `.modal-overlay` that aligns the panel to the right edge: `justify-content: flex-end; align-items: stretch;`. Same fade.
- `.archive-panel` — panel surface. Width 420px / max-width 92vw, height 100%, `background: var(--bg-surface)`, `border-left: 1px solid var(--border-standard)`, `box-shadow: rgba(0,0,0,0.5) -16px 0 40px`. Slide via `transform: translateX(20px)`; `.archive-panel-overlay.open .archive-panel { transform: translateX(0); }`. `display: flex; flex-direction: column.`
- `.archive-panel-head` — flex row, padding `18px 18px 12px`, title + close button.
- `.archive-panel-body` — `flex: 1; overflow-y: auto; padding: 4px 12px 18px;`.
- `.archive-row` — flex column, gap 4px, padding `10px 8px`, border-radius 6px, hover bg `--surface-04`.
- `.archive-row-actions` — flex row, gap 6px, justify-end, margin-top 6px.
- `.archive-row-meta` — `--fg4 / 11px`.
- `.archive-empty` — centered muted copy.
- `.cd-side-action` — block button used by both states in the modal sidebar slot. Full-width, `gap: 6px`, height 30px, justify-content flex-start, `font-size: 12px / 510`. Reuses `.btn-ghost` token; the new modifier `.danger-tone` paints text `--danger` and hover bg `rgba(217,119,119,0.08)` without going full solid red.
- `.btn-toolbar.danger-tone` — same color shift on the toolbar variant for archive-row inline actions. Single shared `.danger-tone` selector handles both: `.cd-side-action.danger-tone, .btn-toolbar.danger-tone { color: var(--danger); } …:hover { background: rgba(217,119,119,0.08); color: var(--danger-hi); }`.

No new color tokens. No icon additions (uses `inbox`, `close`, existing).

## 11. Animations

- Panel slide: 180ms cubic-bezier matching modal slide. Reduced-motion: collapse to instant once F-21 lands.
- Toast: existing `fireToast` already animates.
- Row removal on unarchive/delete-forever: instant unmount in v1; F-21 will add the 180ms collapse.

## 12. Edge cases

- **Card archived while modal is open from sidebar:** modal flips to archived state via `card.archivedAt` change; user sees it immediately and can `Unarchive`.
- **Card unarchived while modal is open from sidebar:** symmetric — flips back to live state.
- **Origin column deleted between archive and unarchive:** falls through to `columns[0]`. Sub-line in panel shows `in <deleted column>`.
- **Hash deep link `#card=<id>` to an archived card:** opens the modal in archived state. Already covered by widening the lookup in §8.
- **All columns deleted while a card is archived:** `unarchiveCard` no-ops (no destination). Defensive, very unlikely.
- **Migrating an old payload where two cards on the same board share an `originColumnId` of a now-deleted column:** both fall through to `columns[0]`. Order preserved by `archivedAt` timestamps.

## 13. Microcopy

- Card kebab: `Archive`
- Modal sidebar live: `Archive card`
- Modal sidebar archived: `Unarchive card`, `Delete forever`
- Permanent-delete confirm: title `Delete this card forever?`, body `This can't be undone.`, confirm `Delete forever`, cancel `Cancel`
- Toasts: `Card archived.`, `Card unarchived.`, `Card deleted.`
- Panel: title `Archived items`, empty `Nothing archived yet.`, row meta `in <column> · <relative>`
- Read-only banner: `This board is closed — archive is read-only.`
- Temp entry point: `View archived (N)`

## 14. PO decisions / open questions

1. Bucket-out vs flag-on-card: recommended bucket-out (board-level `archivedCards`). Locked in §2.
2. Grouping in panel: deferred to flat-list-with-column-in-meta. PO override fine.
3. Restore-position fidelity: column-only on F-14, row-snapshot deferred to F-22 Undo.
4. Solid red `.btn-danger` reserved for irreversible (delete-forever modal); archive uses ghost+danger-tone. Locked.
