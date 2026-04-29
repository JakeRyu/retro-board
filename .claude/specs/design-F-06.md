# F-06 — Drag-and-drop: cards within / between columns; column reorder

## 1. Feature recap

A kanban without DnD isn't a kanban (per backlog rationale). F-06 wires three drag affordances on top of the existing `.col` / `.card` markup: card reorder within a column, card move across columns, and column reorder. Plus keyboard movement for accessibility. The visual language is calm and stable — a translucent ghost where the source was, a tilted "follower" tracking the cursor, and a 2px indigo line marking the drop point. No column reflow during drag (heights stay locked) so users always know where they are. Disabled in closed-board, discussion mode, and during any inline text edit.

## 2. Visual layout

```
[col target]                 [col source]
 ┌────────────────┐           ┌────────────────┐
 │ col-head       │           │ col-head       │
 │ [card]         │           │ [ghost 0.4 op] │ ← source slot stays put
 │ ══ 2px indigo ═│ ← drop    │ [card]         │
 │ [card]         │   point   │                │
 └────────────────┘           └────────────────┘
                ▲
                │  [follower · ~2deg tilt · shadow]  tracks cursor
```

Column drag rotates the idea: a 4px vertical indigo bar between columns marks the drop slot; picked-up column ghosts in place; follower tilts.

## 3. Card drag — within a column

### 3.1 Drag handle

- The **entire card body** (`.card` minus interactive children) is the drag handle.
- These children **swallow** the pointerdown and do NOT initiate drag:
  - `.kebab-trigger` (and any open `.kebab-menu`)
  - `.vote-btn`
  - `.voters` avatars (no current click target, but reserve for v2)
  - `.card-edit-input` (when card is in edit mode the whole card is non-draggable — see §7)
- Cursor: `grab` on `.card` hover (when draggable); `grabbing` while dragging. Default elsewhere.
- Activation distance: drag does not start until the pointer moves **6px** from pointerdown. Below that, treat as a click (so future card-modal click target in F-07 isn't shadowed).

### 3.2 Visual during drag

- **Source ghost**: the original `.card` stays in the DOM at its position with `opacity: 0.4`, `pointer-events: none`, no border highlight change. Class: `.drag-ghost`. The ghost's box still occupies space — column height doesn't collapse.
- **Follower**: a clone of the card rendered into a portal at `position: fixed`, offset to the cursor by the pointer-grab offset (so the card doesn't jump under the cursor). Class: `.drag-follower`.
  - `transform: rotate(2deg)` — slight, not gimmicky.
  - `box-shadow: 0 12px 28px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.3)` — sits clearly above the board.
  - `opacity: 0.95`.
  - No border-color change; the card identity should still read.
- **Drop indicator**: a 2px tall, full-column-width horizontal line in `--brand-indigo`, rendered between the two cards at the insertion point. Class: `.drop-indicator`. It has no height effect on layout (rendered with `margin: -1px 0` or as an absolute-positioned overlay anchored between siblings — implementer's call as long as no reflow).
- **No reflow**: cards do NOT slide apart to make space. The indigo line tells the user the slot. This keeps long columns visually stable during drag and avoids "where did my card go" jitter on every cursor move.

### 3.3 Autoscroll within column

- When the cursor is within the **top 40px** or **bottom 40px** of a `.col-cards` viewport (the column's scrollable area, if the column is scrollable — currently columns aren't independently scrollable in the v1 layout, but the board-area is; see §4.3 for board-area autoscroll, which is the more relevant spec for v1). For columns that overflow vertically (likely once cards accumulate), scroll the column's overflow at **6px / 16ms (~375 px/s)**. Apply only while the pointer is held in the edge zone.
- This is a per-column scroll only; horizontal autoscroll happens at the board-area level (§4.3).

## 4. Card drag — between columns

### 4.1 Visual

- Same ghost + follower as §3.2 — the follower simply continues across column boundaries.
- The indigo `.drop-indicator` follows the cursor: when the cursor is over a target column's `.col-cards` area, the indicator renders between whichever pair of cards the cursor Y is closest to (or at the top / bottom edge if before the first / after the last card).
- The source column's ghost remains where the card was picked up. The source column's indicator is **hidden** while the cursor is over a different column.

### 4.2 Drop position

- Drop position is determined by **cursor Y within the target column's `.col-cards`** (matching where the indicator was rendered when the user released).
- If the target column is empty (`empty-column-hint` showing): the indicator renders as a single full-width line where the empty hint is, and the drop replaces the empty state with the card.
- Drop on `.col-head` itself (above all cards): insert at index 0.
- Drop on the column's `.add-card-btn` area (below all cards): insert at the end.

### 4.3 Board-area horizontal autoscroll

- When the cursor is within the **left 60px** or **right 60px** of the `.board-area` viewport during a card or column drag, scroll horizontally at **6px / 16ms**.
- Stops as soon as the cursor leaves the edge zone or the drag ends.
- Implementation note: hook into the drag library's collision detection so the scroll loop also keeps the indicator and droppable rects in sync.

## 5. Column drag

### 5.1 Drag handle

- The drag handle is the **`.col-head`** (the chrome around the title) — explicitly:
  - Picking up anywhere on `.col-head` background, the `.col-count` pip, or the `.col-title` **when not editing** initiates column drag.
  - When the title is in edit mode (`.col-title-input` is rendered), the entire `.col-head` is non-draggable until the rename commits or cancels (otherwise we steal pointerdowns from the input).
  - The kebab `.col-icon-btn` swallows pointerdown; same as cards.
- Cursor: `grab` on `.col-head` hover (when draggable); `grabbing` while dragging.
- Activation distance: 6px (same as cards).

### 5.2 Visual

- **Source ghost**: the source `.col` stays in place with `opacity: 0.4` (class `.drag-ghost` reused). Width unchanged so the row doesn't reflow. Cards inside the ghost stay rendered as-is (they go along with the column).
- **Follower**: a clone of the entire column rendered into a portal at `position: fixed`. Class `.drag-follower` reused.
  - `transform: rotate(2deg)`
  - same shadow as card follower
  - `opacity: 0.95`
  - max-height capped at viewport height; if the source column is taller than viewport, the follower clips with `overflow: hidden` (don't render an unwieldy 2000px floating shape).
- **Drop indicator**: a **4px-wide, full-column-height vertical bar** in `--brand-indigo` between two columns at the insertion slot. Class: `.drop-indicator-col`. Same no-reflow rule — adjacent columns do NOT slide.

### 5.3 Movement axis

- Column drag is **horizontal-only**. The follower's Y is locked to the source column's Y; only X tracks the cursor. This keeps columns visually anchored to their row and avoids accidental "I dropped my column on top of a card."
- Vertical cursor movement during a column drag has no effect on the indicator position.

## 6. Keyboard accessibility

- **Focus on cards**: each `.card` becomes `tabindex="0"`. Tab order: column 1 cards top→bottom, then column 2 cards, etc. (Within the column, after the `Add a card` button.)
- **Focus ring**: `outline: 1px solid var(--brand-indigo); outline-offset: 2px;` plus `box-shadow: 0 0 0 3px rgba(94,106,210,0.15);` — matches the existing `.col-title-input` / `.add-card-input` focus halo. Class hook: `.card:focus-visible`.
- **Move-within-column**: `Ctrl/Cmd + ArrowUp` / `Ctrl/Cmd + ArrowDown` reorders the focused card up / down by one position. Focus stays on the card. **Clamp** at top / bottom — no wrapping. (Wrapping would land the user in a different visual region than expected.)
- **Move-across-column**: `Ctrl/Cmd + ArrowLeft` / `Ctrl/Cmd + ArrowRight` moves the focused card to the adjacent column at the **same index** (i.e. 3rd-from-top stays 3rd-from-top). If the target column is shorter, drop at the **end** of that column. **Clamp** at first / last column — no wrap.
- **Announce**: after a keyboard move, a polite `aria-live` announcement fires: `Moved to {column title}, position {N} of {M}.` Reuse `@dnd-kit`'s built-in screen-reader announcer if the lib option is taken.
- **Esc during drag**: cancels the drag (mouse-initiated or keyboard-initiated). Source returns to original position. No announcement beyond `Move cancelled.`
- **Column keyboard reorder**: out of scope for v1 — focus on column header is currently undefined and `.col-head` is not a tab stop. Flag Q3.

## 7. Disabled states

| State | Card drag | Column drag | Keyboard moves | Cursor on `.card` / `.col-head` |
|---|---|---|---|---|
| Closed board (`readOnly`) | disabled | disabled | disabled | `default` |
| Discussion mode | disabled (sort-by-votes wins) | disabled | disabled | `default` |
| Card in edit mode (`.card-edit-input` showing) | that one card non-draggable | other columns OK | the editing card blocks Tab-out via Esc to commit, then keys re-enable | `text` over input |
| Column in rename mode (`.col-title-input` showing) | cards in that col still draggable | that column non-draggable | OK on cards | `text` over input |
| Add-card composer open | the column itself still draggable; cards still draggable | OK | OK | normal |

Closed-board and discussion-mode disablement are board-wide flags (already in props). Edit-mode disablement is a per-component check (drag library's `disabled` prop tied to local `editing` state).

## 8. Drop animation

- On release over a valid drop zone, the dropped card / column **slides into its final position over 140ms ease-out**. Matches the existing card-hover transform timing. Use `transform` on the settling element only — siblings don't animate (no cascading reflow).
- On release over an invalid zone (off-board, on the source itself with no movement, Esc): the follower **fades out over 100ms** while the ghost's opacity returns to 1. No bounce-back.
- `prefers-reduced-motion: reduce` → drop is instant; no follower tilt; no slide. Indicator still shows during drag (it's information, not decoration).

## 9. Library decision

**Recommend `@dnd-kit/core` + `@dnd-kit/sortable`.** This is a new dependency — PO must approve.

Rationale:
- Industry-standard for React DnD; actively maintained.
- ~22kb gzipped (core + sortable). Reasonable for a P0 feature touching every kanban interaction.
- **Built-in keyboard accessibility** with screen-reader announcements — meeting §6 from scratch with HTML5 DnD or pointer events is multiple weeks of work and historically fragile.
- Built-in autoscroll, custom drop indicator support, modifiers (e.g. lock-axis for column drag §5.3), portal-mounted overlays for the follower (`<DragOverlay>` matches §3.2 and §5.2 exactly).
- Sensor abstraction: PointerSensor for mouse + KeyboardSensor for §6 keyboard moves; touch sensor exists but is **out of scope per backlog** — leave PointerSensor only for v1.

**Why not DIY HTML5 DnD?** Drag-image is a snapshot (no live tilt + shadow follower); `dragenter`/`dragleave` is flaky for sub-element targets (indicator-between-cards); keyboard a11y is not part of the API; autoscroll needs a hand-rolled rAF loop.

**Why not `react-beautiful-dnd`?** Unmaintained since 2022; React 19 support is broken; project is dead.

**Bundle impact**: tree-shakeable; pull `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/modifiers` (lock-axis for column drag §5.3) for ~25kb gz total.

## 10. CSS additions

All new classes live in `app/globals.css` next to the existing `.card` / `.col` rules. No new design tokens — reuses `--brand-indigo`, `--surface-*`, `--bg-marketing`.

```css
/* Source-card / source-column ghost — stays in place at reduced opacity. */
.drag-ghost {
  opacity: 0.4;
  pointer-events: none;
}

/* The portal-rendered clone that tracks the cursor.
   Applied to dnd-kit's <DragOverlay> child. */
.drag-follower {
  transform: rotate(2deg);
  opacity: 0.95;
  box-shadow:
    0 12px 28px rgba(0, 0, 0, 0.45),
    0 2px 6px rgba(0, 0, 0, 0.3);
  cursor: grabbing;
  pointer-events: none;
}
.drag-follower.col {
  /* When dragging a column, cap height so very tall columns don't render as a giant overlay. */
  max-height: 80vh;
  overflow: hidden;
  border-radius: 10px;
}

/* Horizontal indigo line between cards at the drop point. */
.drop-indicator {
  height: 2px;
  background: var(--brand-indigo);
  border-radius: 1px;
  margin: 0;            /* no reflow — implementer to overlay or use negative margins */
  pointer-events: none;
}

/* Vertical indigo bar between columns at the drop point. */
.drop-indicator-col {
  width: 4px;
  align-self: stretch;
  background: var(--brand-indigo);
  border-radius: 2px;
  pointer-events: none;
}

/* Cursor + focus affordances on draggable surfaces. */
.card { cursor: grab; }
.card:active,
.card.dragging { cursor: grabbing; }
.col-head { cursor: grab; }
.col-head:active,
.col-head.dragging { cursor: grabbing; }

/* Override cursor when drag is disabled (read-only, discussion, edit modes). */
.app[data-readonly="true"] .card,
.app[data-readonly="true"] .col-head,
.app[data-discussion="true"] .card,
.app[data-discussion="true"] .col-head,
.card:has(.card-edit-input),
.col-head:has(.col-title-input) {
  cursor: default;
}

/* Card focus ring (keyboard a11y). */
.card:focus-visible {
  outline: 1px solid var(--brand-indigo);
  outline-offset: 2px;
  box-shadow: 0 0 0 3px rgba(94, 106, 210, 0.15);
}

/* Reduced motion: no tilt on the follower; instant drop. */
@media (prefers-reduced-motion: reduce) {
  .drag-follower { transform: none; }
}
```

Class hook `.dragging` is set by the drag library on the source element; `.drag-ghost` is set on the placeholder. (`@dnd-kit` exposes both via render-prop / `useSortable` state — implementer wires them.)

## 11. Microcopy

| Place | Copy |
|---|---|
| Screen-reader announce on pickup | `Picked up {card body, truncated to 60ch}.` |
| Keyboard move within column | `Moved up.` / `Moved down.` (clamp: `Already at top.` / `Already at bottom.`) |
| Keyboard move across columns | `Moved to {column title}, position {N} of {M}.` (clamp: `No column to the {left/right}.`) |
| Drop / cancel | `Dropped in {column title}, position {N} of {M}.` / `Move cancelled.` |
| Closed-board / discussion attempt | (silent — cursor stays default, drag never starts; no toast) |

No visible toasts on drag — the visual indicator + drop animation are the feedback.

## 12. Edge cases

- **Single-column board**: within-column drag works; cross-column / column drag are no-ops (follower renders, no indicator slot, returns to source on release).
- **Empty target column**: indicator renders where `Nothing here yet.` is; drop replaces the hint. Hint reappears if column re-empties.
- **Last card leaves a column**: drop animation runs first, then the empty hint cross-fades in (140ms). Lock column height during the drop transition to avoid jank.
- **Concurrent vote/kebab click during drag**: child interactives swallow pointerdown (§3.1). Once a drag is in flight, all vote/kebab targets across the board are non-interactive until release — single concern at a time.
- **Card in edit mode while another card is dragged**: editing card stays in edit mode and is itself non-draggable (`useSortable` `disabled`); other drags proceed normally.
- **Tab loses focus mid-drag**: cancel (treat `visibilitychange` as Esc); source returns to origin, no announcement.

## 13. PO decisions

> Resolved 2026-04-29 by Product Owner. Replaces the prior open-questions block. No further PO sign-off required for F-06 to proceed to implementation.

- **D1 — Library approved.** Add `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/modifiers` (~25kb gz). DIY HTML5 DnD and `react-beautiful-dnd` are both rejected per §9 rationale (no keyboard a11y / dead project). DnD is a P0 of a "complete kanban product"; the bundle cost is justified. Implementer installs the three packages alongside F-06.
- **D2 — Defer per-column vertical scroll cap.** Do **not** introduce `max-height` on `.col-cards` as part of F-06. The board-area horizontal autoscroll (§4.3) is the v1 autoscroll story; §3.3 (per-column vertical autoscroll) is a no-op for v1 and stays in the spec only as forward-compatible code paths the library gives us for free. The column-height + internal-scroll question is a layout decision that affects empty states, the add-card composer, and column drag follower sizing — it deserves its own UX pass rather than being smuggled in through F-06. Re-open as a separate ticket once cards-per-column regularly exceed viewport height in real use.
- **D3 — Approve column keyboard reorder.** Yes, ship `.col-head` as tab-focusable with `Ctrl/Cmd + Shift + ArrowLeft/Right` to move the focused column. Use `Shift` (not bare `Ctrl/Cmd + Arrow`) to disambiguate from the card move-across-column keys when a card inside the column is the actual focus target during rapid Tab-through. Reuse the same `aria-live` announcer (`Moved column to position {N} of {M}.` / `No column to the {left/right}.`). Update §6 of this spec accordingly during implementation. This change is in-scope of F-06's existing AC ("Keyboard accessibility: a focused card can be moved with `Ctrl/Cmd+Arrow` keys") — extending parity to columns is a clarification, not a new AC, and the backlog has been updated to reflect that.
- **D4 — Touch sensor stays out of v1.** Confirmed deferred. Do not wire `@dnd-kit`'s `TouchSensor`. Backlog AC stands ("mouse + keyboard only — touch deferred"). Revisit when we have a touch-device user signal or a tablet-first feature request.
