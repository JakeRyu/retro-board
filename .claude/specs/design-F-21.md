# F-21 — Realtime affordances polish (final pass)

> Final polish pass. Ships the cheap wins from the HANDOVER §4.4 animation list,
> closes the F-06 / F-07 / F-09 / F-13 / F-14 punts that were tagged "for F-21",
> and documents what's deferred and why so a follow-up has a clean starting point.

## Items checklist

### 1. New-card pulse on cross-column DnD arrival — **shipped**

`.card.new` already runs the 360ms `card-in` keyframe on `addCard` via the
`newIds` set in `RetroApp`. Backlog AC 1 wants the same pulse on a card that
*moves* into a column from a *different* column. Implemented in `onDragEnd`:
when the drop's `fromColumnId !== targetColId`, push the card id into `newIds`
for the same 600ms window the `addCard` flow uses. Same-column reorder does not
trigger the pulse (would be visual noise — nothing actually changed columns).

### 2. Card-edit cross-fade on body change — **shipped**

`.card-body` gets a 140ms opacity transition keyed on `card.body` so a remote /
self edit settles instead of teleporting. The `.card-body` element uses the
saved body as its React `key`; React's reconciler unmounts the old node and
mounts a new one, and CSS `@keyframes body-fade-in` runs on the fresh node.
Handled purely in CSS — no JS state.

### 3. Card-archive collapse (180ms height + opacity) — **shipped**

When the kebab `Archive` or modal sidebar `Archive card` runs, we add
`.card.archiving` to the source DOM node, wait one frame so the browser
captures the start height, then on the next frame trigger the `max-height: 0;
opacity: 0` transition. After 180ms the actual `storeActions.archiveCard` runs.
Implemented as a small helper `runCardArchiveCollapse(cardId, run)` in
`Card.tsx` that does the rAF chain and falls through to the action. Reduced
motion bypasses the wait and fires the action immediately.

### 4. Column add/delete fade — **shipped**

Add: the new `.col` mounts with `.col.col-new` which runs a 240ms
`col-fade-in` keyframe (opacity + 4px translateY). Cleared by the same
existing `setAutoEditColId` rAF tick — no extra state.

Delete: deferred. Animating column removal correctly requires either grid-area
animation tricks or measuring `offsetWidth` and animating `max-width: 0` while
also handling the `flex-direction: row` neighbours. Cost / benefit doesn't
clear the bar for a v1 polish pass, especially with column delete already
gated behind a confirm. Documented here so a future pass has a starting
point. (Card-archive collapse §3 covers the more common case.)

### 5. Reduced-motion media query disables animations — **shipped**

A single `@media (prefers-reduced-motion: reduce)` block at the top of the
animation section nukes `.card`, `.col`, `.toast`, `.modal`, `.modal-overlay`,
`.archive-panel`, `.theme-bar`, and `.discussion-bar` transitions, plus zeros
all the `@keyframes`-named animations. The drop indicator (informational) and
the F-06 reduced-motion follower-tilt rule already in the file are preserved.

### 6. Drop indicator overlay (literal indigo line) — **deferred**

F-06 specifies a 2px indigo line for cards / 4px vertical bar for columns
between siblings to mark the insertion slot. Implementing this on top of the
current `closestCorners` collision strategy with no-reflow constraints is
non-trivial: dnd-kit doesn't expose a "which gap am I over" hook, so we'd need
to derive the insertion index from the `over.id` + cursor `Y` against the
target column's children rects on every `onDragMove`, render an absolutely-
positioned `.drop-indicator` into a portal at that gap, and de-bounce against
the live store moves we already do in `onDragOver`. Each of these is a small
amount of code; together they're the kind of "spent a day fighting dnd-kit"
work that a final-polish pass shouldn't soak. Today the moved card's own slot
shift is the user feedback, and it's been live since F-06 with no complaints.

Documented status: deferred to v2 alongside touch-DnD.

### 7. Custom 140ms ease-out drop animation — **shipped**

`<DragOverlay dropAnimation={DROP_ANIM}>` overrides the default 250ms `ease`
with `{ duration: 140, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1)' }` to match
F-06 §8 ("slides into final position over 140ms ease-out"). Reduced-motion
sets `dropAnimation={null}` so the follower disappears instantly with no
slide.

### 8. Pointerdown-leak fix on confirm overlays — **shipped**

The card-details modal already uses the pointerdown-vs-click pattern (track
whether pointerdown landed on the overlay; only treat the click as an overlay
click if both did). Three remaining `RetroApp.tsx` confirm overlays
(close-board, delete-column, archive-board, delete-card-forever),
`ShortcutsCheatSheet`, and `CreateBoardDialog` all used the simpler "click on
overlay → close" pattern, which leaks: a textarea text-selection drag that
releases over the overlay closes the modal. All five sites converted to the
shared pattern via a small `useOverlayDismiss` hook in `_hooks/`.
`BoardSettingsMenu`'s two modals and `ArchivedItemsPanel` already use the
pattern; left as-is.

## Files touched

- `app/globals.css` — animation keyframes, reduced-motion block, `.col-new`,
  `.card-body` fade, archive-collapse rules.
- `app/_components/Card.tsx` — archive-collapse helper, body-key for cross-
  fade, archive button wired through it.
- `app/_components/RetroApp.tsx` — `dropAnimation` config on `DragOverlay`,
  cross-column pulse, all confirm overlays converted to `useOverlayDismiss`.
- `app/_components/Column.tsx` — `col-new` class hook on mount.
- `app/_components/ShortcutsCheatSheet.tsx`,
  `app/_components/CreateBoardDialog.tsx` — converted to `useOverlayDismiss`.
- `app/_hooks/useOverlayDismiss.ts` — new shared hook.

## Out of scope (per backlog)

Lost-connection banner, presence tooltips, animations triggered by other
users — all backend-blocked and explicitly deferred in F-21 backlog AC.
