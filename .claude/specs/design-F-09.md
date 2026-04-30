# F-09 — Card checklist (in modal)

## 1. Feature recap

Lives inside `.cd-checklist` (the F-07 main-column slot, second row).
A single checklist per card lets users break work into checkable steps and see
progress. Multi-checklist is explicitly cut from v1 per backlog. The card
preview gains a small "X/Y" indicator next to the description glyph so the
board reads progress without opening the card.

## 2. Surface

`.cd-checklist` already ships from F-07 with the `<h3 class="cd-section-label">Checklist</h3>`
heading. F-09 fills the body with three regions stacked top-to-bottom:

1. **Header row** — progress + "Hide completed" toggle (right-aligned).
2. **Item list** — sortable, one row per `ChecklistItem`.
3. **Add-item composer** — single-line input pinned at the bottom.

```
┌─ .cd-checklist ──────────────────────────────────────┐
│  Checklist                                           │  ← cd-section-label (F-07)
│  ┌─ .checklist-head ─────────────────────────────┐   │
│  │  3 / 5 complete           [Hide completed ▢]  │   │
│  └───────────────────────────────────────────────┘   │
│  ┌─ .checklist-list (SortableContext) ───────────┐   │
│  │  ⋮⋮  ☑  Wire the action ........... [×]       │   │  ← .checklist-item.done
│  │  ⋮⋮  ☐  Hook up the modal .........            │   │  ← .checklist-item
│  │  ⋮⋮  ☐  Polish empty state ........            │   │
│  └───────────────────────────────────────────────┘   │
│  ┌─ .checklist-add ──────────────────────────────┐   │
│  │  + Add an item ▏                              │   │
│  └───────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

## 3. States

| State | Visual |
|---|---|
| Empty (no items) | Header shows `0 / 0 complete`. "Hide completed" hidden (no use). Item list is absent. Composer visible with placeholder `Add an item`. |
| Default | Items in author-defined order. Completed last only if the user reorders that way — sort is **manual**, not by `done`. |
| Hover on item | Row gets `background: var(--surface-02)`. Drag handle (`.checklist-handle`) and delete button (`.checklist-del`) fade in via opacity 0→1 / 120ms. |
| Item completed | `.checklist-text.done` — `text-decoration: line-through; color: var(--fg4)`. Wrapper opacity `0.7`. |
| Item editing text | `.checklist-text` is replaced by an inline `<input>` with the same indigo glow as `.cd-description-input`. |
| Hide completed on | Items with `done === true` are filtered out of the list render. Header progress unchanged. Toggle pill shows pressed state. |
| Read-only (closed) | All controls disabled — checkboxes, drag handles, delete buttons, "Hide completed" toggle, composer input. Items still visible (struck-through retained). Cursor stays default. |
| Drag in flight | Source row shows `.drag-ghost` (opacity 0.4); follower rendered in `<DragOverlay>` portal with the same `.drag-follower` treatment as cards (rotate 2deg, shadow). Drop indicator: a 2px `--brand-indigo` line between rows (reuse `.drop-indicator` class from F-06). |

## 4. Interaction spec

### 4.1 Add an item

- **Trigger**: focus the composer input (always mounted at the bottom). No
  separate "+ Add" button — input itself is the affordance.
- **Placeholder**: `Add an item`.
- **Submit**: `Enter` creates the item via `addChecklistItem`, clears the
  draft, **keeps focus** on the composer so users can rapid-fire adds.
- **Discard**: blur with empty input does nothing — no item is created. Blur
  with non-empty input does **not** auto-submit (matches the "add card"
  composer pattern: explicit Enter creates, blur cancels). Esc clears the
  draft and blurs.
- **Validation**: trim. Reject empty after trim (no-op). No max length in v1
  beyond input default — long items wrap.

### 4.2 Toggle complete

- **Trigger**: click on `.checklist-checkbox` or press Space when the
  checkbox is focused.
- **Result**: dispatches `toggleChecklistItem`. Row immediately re-renders
  with `.done` modifier. Header progress updates.
- **Read-only**: checkbox is `disabled` per backlog AC ("all controls disabled
  for closed boards"). Confirmed: even toggling is blocked when read-only.

### 4.3 Edit item text

- **Trigger**: click on `.checklist-text`. Replaces the rendered span with an
  `<input>` autofocused, cursor at end. **Or** press Enter when the row is
  keyboard-focused.
- **Save**: `Enter` or blur. Trims; if empty after trim, **discard the edit
  and revert to saved value** (do not delete the item — explicit delete is the
  trash button). If unchanged, no store write.
- **Cancel**: `Esc` reverts and exits edit mode. Stops propagation so the
  modal's Esc handler doesn't fire.

### 4.4 Delete item

- **Trigger**: click `.checklist-del` (× icon, visible on row hover/focus).
- **Result**: immediate `deleteChecklistItem` — no confirm. Symmetry with
  card composer's "Add a card · cancel" pattern: per-item destructive ops on
  small lists don't warrant a modal. Undo is owned by F-22.
- **Keyboard**: while row is focused, `Backspace` (when not in edit mode)
  also deletes. (Cheap; matches Trello.)

### 4.5 Reorder

- **Trigger**: drag on `.checklist-handle` (small grip icon, left of the
  checkbox). Activation distance `6px`, matches F-06.
- **Result**: dispatches `reorderChecklist(boardId, cardId, fromIndex, toIndex)`.
- **Keyboard**: dnd-kit's KeyboardSensor handles `Space` to pick up,
  arrow keys to move, `Space`/`Enter` to drop, `Esc` to cancel. We get this
  free by reusing the same sensor configuration.
- **Disabled**: drag disabled when `readOnly`, when the item is in text-edit
  mode, and when "Hide completed" is on (filtered list breaks index math —
  flag below in §10).

### 4.6 Hide completed

- **Trigger**: toggle pill `.checklist-toggle-hide` in the header row, right
  side. Same visual idiom as `.anon-toggle` (small pill, switch ball).
- **State**: per-modal-session — local React state inside `Checklist`, resets
  to `false` whenever the modal mounts. Not persisted, not on the card.
- **Visibility**: pill is hidden when there are zero completed items (no use
  for it).

## 5. Card preview indicator

When `card.checklist` exists and `length > 0`, show a small indicator in the
existing `.vote-row` of `Card.tsx`, **left of** the `.card-desc-indicator`
(so when both are present they read: checklist count, then description glyph,
then voters/votes).

- Class: `.card-checklist-indicator`. Same color/spacing conventions as
  `.card-desc-indicator`.
- Content: `<Icon name="checklist" size={12} />` glyph + small text
  `"X/Y"` in `var(--font-mono)`, font-size 10px, color `--fg4`. When all items
  done, color flips to `--status-emerald` (matches the "complete" feel).
- `aria-label="X of Y checklist items complete"`, `title` similar.

### Glyph

`Icon` primitive does not yet ship a `checklist` glyph. Add `IconName = "checklist"`
with path: `M9 5h11M9 12h11M9 19h11M4 5l1.5 1.5L8 4M4 12l1.5 1.5L8 11M4 19l1.5 1.5L8 18`
(three rows with leading checkmarks). Justified addition: this is the canonical
"checklist" affordance and is parallel to F-08's `description` glyph.

## 6. Read-only

When the parent modal passes `readOnly={true}`:

- Checkboxes `disabled`. (Backlog spec says all controls disabled including
  toggles — confirmed.)
- Drag handle hidden (no `.checklist-handle` rendered when readOnly).
- Delete button hidden.
- "Hide completed" toggle hidden — there's nothing the user can do, so the
  affordance is noise.
- Composer hidden. Items render in current order, struck-through where done.
- Header progress still shows.

## 7. DnD architecture

The parent `RetroApp` has its own `DndContext` for cards/columns. Nesting
`DndContext` is officially discouraged (bug-prone). The card details modal
sits in a portal-like overlay above the board and **does not share drag
space** with it — there's no scenario where a user drags a checklist item
out of the modal onto the board.

**Decision**: open a **separate `DndContext`** scoped inside the `Checklist`
component. Reuse the same `PointerSensor` (6px distance) and `KeyboardSensor`
from F-06 so behavior is consistent. A single `SortableContext` keyed by
`item.id` lists with `verticalListSortingStrategy`.

- `DragOverlay` rendered inside the modal so the follower clones over the
  modal content (z-index correct by default — overlay portal sits inside the
  same stacking context as the modal).
- No cross-context drops are possible because the modal overlay covers the
  board pointer-events.

## 8. CSS

All new classes live in `app/globals.css` under a new `/* card checklist
(F-09) */` section adjacent to `.cd-description-*`. No new tokens.

```css
.checklist { display: flex; flex-direction: column; gap: 6px; }

.checklist-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 4px;
  font-size: 11px; color: var(--fg4);
}
.checklist-progress { font-family: var(--font-mono); font-size: 11px; color: var(--fg3); }

.checklist-toggle-hide {
  /* Reuses the .anon-toggle visual pattern but smaller. */
  display: inline-flex; align-items: center; gap: 6px;
  height: 22px; padding: 0 8px;
  border-radius: 999px;
  border: 1px solid var(--border-1);
  background: var(--surface-02);
  color: var(--fg3);
  font-size: 11px; font-weight: 510;
  cursor: pointer;
}
.checklist-toggle-hide[data-on="true"] {
  background: rgba(94,106,210,0.12);
  border-color: rgba(94,106,210,0.4);
  color: var(--brand-violet-hi);
}

.checklist-list { display: flex; flex-direction: column; }

.checklist-item {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 4px;
  border-radius: 6px;
  min-height: 28px;
  transition: background 120ms ease;
}
.checklist-item:hover,
.checklist-item:focus-within { background: var(--surface-02); }

.checklist-handle {
  width: 14px; height: 14px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--fg4);
  cursor: grab;
  opacity: 0;
  transition: opacity 120ms ease;
}
.checklist-item:hover .checklist-handle,
.checklist-item:focus-within .checklist-handle { opacity: 1; }
.checklist-handle:active { cursor: grabbing; }

.checklist-checkbox {
  /* Native checkbox, restyled to match the dark surface. */
  appearance: none;
  width: 14px; height: 14px;
  border: 1px solid var(--border-2);
  border-radius: 3px;
  background: var(--surface-02);
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
}
.checklist-checkbox:checked {
  background: var(--brand-indigo);
  border-color: var(--brand-indigo);
}
.checklist-checkbox:checked::after {
  content: ""; position: absolute;
  left: 3px; top: 0px; width: 4px; height: 8px;
  border: solid #fff; border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.checklist-checkbox:disabled { cursor: default; opacity: 0.6; }

.checklist-text {
  flex: 1; min-width: 0;
  font-size: 13px; color: var(--fg2);
  cursor: text;
  padding: 2px 4px; border-radius: 4px;
  word-break: break-word;
}
.checklist-text.done { text-decoration: line-through; color: var(--fg4); }
.checklist-item.done { opacity: 0.7; }

.checklist-text-input {
  flex: 1; min-width: 0;
  background: var(--bg-surface); color: var(--fg1);
  border: 1px solid var(--brand-indigo); border-radius: 4px;
  padding: 2px 6px;
  font: inherit; font-size: 13px;
  outline: none;
  box-shadow: 0 0 0 3px rgba(94,106,210,0.15);
}

.checklist-del {
  /* Mirrors .col-icon-btn but smaller; visible on hover/focus. */
  width: 20px; height: 20px;
  border: none; border-radius: 4px;
  background: transparent; color: var(--fg4);
  cursor: pointer;
  opacity: 0; transition: opacity 120ms ease;
  display: inline-flex; align-items: center; justify-content: center;
}
.checklist-item:hover .checklist-del,
.checklist-item:focus-within .checklist-del { opacity: 1; }
.checklist-del:hover { color: var(--brand-violet-hi); background: var(--surface-04); }

.checklist-add {
  margin-top: 4px;
}
.checklist-add-input {
  width: 100%;
  background: var(--surface-02); color: var(--fg1);
  border: 1px solid var(--border-1); border-radius: 6px;
  padding: 6px 10px;
  font: inherit; font-size: 13px;
  outline: none;
}
.checklist-add-input:focus {
  border-color: var(--brand-indigo);
  box-shadow: 0 0 0 3px rgba(94,106,210,0.15);
}

/* Card preview indicator. Sits to the left of .card-desc-indicator in .vote-row. */
.card-checklist-indicator {
  display: inline-flex; align-items: center; gap: 3px;
  color: var(--fg4);
  margin-right: 4px;
  font-family: var(--font-mono); font-size: 10px;
}
.card-checklist-indicator.complete { color: var(--status-emerald); }
```

## 9. Animations

- Item add: relies on React mount; no special pulse (matches description).
- Item delete: instant (the row disappears). F-21 will add a 180ms collapse
  along with the global card-delete polish.
- Drag: `.drag-ghost` + `.drag-follower` reused from F-06 — no new
  animation rules.
- Reduced motion: inherits — no extra @media block needed.

## 10. Edge cases & PO flags

1. **Reorder while "Hide completed" is on.** With completed items filtered
   from view, `fromIndex`/`toIndex` from dnd-kit refer to the *visible*
   list, not the canonical one. Two clean options:
   (a) disable drag while the toggle is on (simplest, ship this).
   (b) translate visible indices to canonical via the saved id list before
       calling the store action.
   **Decision for v1: option (a).** Drag handle hidden when "Hide completed"
   is on. This is the simpler, less surprising path — users who want to
   reorder turn the filter off first.

2. **Item ids.** Use `"cli-" + Date.now().toString(36) + "-" + counter`
   pattern (collision-safe within a session) — matches `addColumn` /
   `addLabel` style in `store.ts`.

3. **Persistence shape.** `Card.checklist` is already optional; empty
   arrays should be normalized to `undefined` after a delete leaves zero
   items (matches the labels/assignees pattern in the store) so persisted
   payloads stay minimal.

4. **Card preview indicator** placement: inside `.vote-row`, before
   `.card-desc-indicator`. When both indicators present, no extra
   separator — the existing `gap` on `.vote-row` (or natural inline
   spacing) carries it.

5. **Discussion mode** — checklist still toggleable? Discussion mode for a
   retro is a *facilitation* mode, not a read-only mode. F-07 lets the
   modal open in discussion mode. Backlog F-09 only flags read-only
   (closed-board) as the disablement axis. **Confirm with PO**: assume
   discussion mode is *not* a disablement axis for checklist edits.

## 11. Microcopy

| Place | Copy |
|---|---|
| Header progress | `X / Y complete` |
| Hide-completed toggle (off) | `Hide completed` |
| Hide-completed toggle (on) | `Showing in-progress` |
| Composer placeholder | `Add an item` |
| Card preview indicator title/aria | `X of Y checklist items complete` |
| Empty list, no completed yet | (no extra copy — composer placeholder is enough) |

No toasts on add/toggle/delete — too chatty, matches description silence.

