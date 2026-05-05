# F-23 — Finish Discussion → Action column

> Date: 2026-05-01
> Depends on: F-09 (action items on cards), F-20 (export reads Action column)

---

## Goal

The retro meeting ends when discussion mode does, but the commitments the team
captured on individual stickies are invisible unless someone digs into each card
modal. F-23 closes the loop: clicking "Finish discussion" gathers every action
item from every live sticky and builds a dedicated Action column at the right
side of the board, giving the whole team a single at-a-glance view of what
we're committing to before the session ends.

---

## Trigger

The "Finish discussion" button already exists on the discussion bar (rendered
only when `isLast === true`, i.e., the facilitator is viewing the final column).
Its current `onClick` calls `exitDiscussion()` directly.

After F-23, that onClick invokes a new handler — `onFinishDiscussion` — instead.
The button itself does not change appearance: same `.btn.btn-primary` class,
same label "Finish discussion", same position at the right of the `.nav` cluster
in the discussion bar. No extra affordance is added to the button; the rebuild
is the expected outcome of finishing.

**Flow branch:**
1. The Action column does not yet exist, OR it exists but is empty: rebuild
   proceeds immediately, no confirm modal.
2. The Action column exists AND has at least one live card: show the confirm
   modal before proceeding.

"Action column" is identified by `Column.kind === "action"` (see Data model
changes section). This marker, not the column title, is the canonical identity
test.

---

## Rebuild flow (happy path)

When the rebuild proceeds (confirmed or no confirmation needed):

1. Collect every live card from every live column whose `col.kind` is NOT
   `"action"`. ("Live" means not in `board.archivedCards`.)
2. For each such column, sorted by column position (left to right in
   `board.columns`), collect that column's cards sorted by `voters.length`
   descending (ties preserve original card order — stable sort).
3. Within each card, expand `card.actionItems ?? []` in item order.
4. Each action item becomes one new `Card` object:
   - `id`: fresh generated id
   - `body`: `actionItem.text`
   - `authorId`: `"me"` (the facilitator initiating the rebuild)
   - `voters`: `[]`
   - `sourceCardId`: the id of the card the item came from (new optional field)
5. Locate the Action column (`col.kind === "action"`). If it exists, replace its
   `cards` array wholesale with the new cards. If it doesn't exist, create a new
   column `{ id: "action-col", kind: "action", title: "Action", desc: "",
   cards: [...] }` and append it to `board.columns`.
6. Exit discussion mode (`setDiscussion(false)`).
7. Scroll the board area to the rightmost position so the Action column is
   immediately visible.
8. Fire a success toast (see Toast feedback section).

If the gathered action items list is empty after step 3 (no items were captured
on any card), the same steps run but the Action column's `cards` array is empty.
Toast uses the empty-state copy instead.

---

## Confirm modal

**When shown:** The Action column (`col.kind === "action"`) exists AND
`col.cards.length > 0`.

**Layout:** Standard `.modal-overlay` + `.modal` pattern, matching the
close-board and archive-board confirm modals already in `RetroApp.tsx`. Uses
`useOverlayDismiss` for the pointerdown-vs-click guard. Width is the default
modal width (auto, ~420px max, centered).

```
[modal]
  Rebuild Action column?
  The current action items will be replaced. This can't be undone.

  [Cancel]  [Rebuild]
```

**Title:** `Rebuild Action column?`
**Body:** `The current action items will be replaced. This can't be undone.`
(Slightly stronger than PO's suggestion because this is a destructive action
with no undo path — F-22 undo does not cover Action column rebuilds. Being
explicit protects the facilitator from an accidental second Finish.)

**Buttons:**
- Cancel: `.btn.btn-ghost` label `Cancel` — exits discussion mode WITHOUT
  rebuilding. The Action column and its existing cards remain untouched.
- Rebuild: `.btn.btn-danger` label `Rebuild` — proceeds with the replace.

**Justification for Cancel exiting discussion:** The facilitator clicked
"Finish discussion." Discussion should end regardless of what they decide about
the Action column. Keeping the team in discussion mode after they've clicked
Finish creates a confusing state (the discussion bar remains, navigation pips
are still shown). The Action column decision is separate from the discussion
lifecycle. Cancel = "don't replace what's there, but we're done discussing."

**Dismissal:**
- Esc: cancels (exits discussion mode, keeps existing Action column).
- Pointerdown on overlay: uses `useOverlayDismiss` — same guard as other confirm
  modals. Triggers Cancel semantics (exit discussion, no rebuild).
- Pointerdown inside modal: does not dismiss.

**Tab order inside modal:** Cancel (first Tab stop) → Rebuild. Focus lands on
Cancel by default on modal open so the keyboard-safe path requires an
intentional move to Rebuild.

---

## Empty-state path

If no action items exist on any live card (step 3 above produces zero items):

- The rebuild still runs: Action column is created or emptied.
- No confirm modal, even if the existing Action column has stale cards.
  Rationale: replacing stale items with nothing is semantically identical to a
  normal rebuild; the result (an empty Action column) is unambiguous and
  harmless.
- Toast: `"No action items were captured."` (PO copy, kept verbatim).
- The empty Action column renders its standard `.empty-column-hint` placeholder:
  `"Nothing here yet."` (existing copy — no special override needed).

---

## Action column visual

**Chosen treatment: (b) indigo top-border stripe + (d) locked identity.**

The Action column renders as a standard `.col` but with two modifications:

### Top-border stripe

```css
.col.action-col {
  border-top: 2px solid rgba(94, 106, 210, 0.6);
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
}
```

The 2px indigo stripe at the top edge signals "this column is the outcome, not
a prompt." It reuses `--brand-indigo` at 60% opacity so it reads as distinct
without being aggressive. The existing `.col` border-radius is preserved on the
top corners.

Why (b) over (a): The Action column is the only column that the system writes
to. A visible signal prevents the facilitator from confusing it with a prompt
column they manually created. The stripe is the same indigo family as focus
rings, vote buttons, and the discussion-mode halo — consistent language.

Why (b) over (c): A title icon adds cognitive load to read (what icon? what does
it mean?) whereas a border stripe reads as "different kind" instantly without
demanding interpretation. The `actions` checkmark icon already has meaning on
card previews (F-09); reusing it on the column title would create a false
parallel.

### Locked identity

The Action column kebab menu (Rename / Delete) is fully hidden. The Column
component receives a `isActionCol` prop (boolean, derived from
`col.kind === "action"`) that suppresses the `.col-actions` block entirely. The
column title renders as non-editable text (`titleEditable` is false when
`isActionCol` is true) even when `canEdit` is otherwise true.

The facilitator CAN delete the Action column manually via a separate path if
needed (described under Behavior matrix). What is locked is rename and the
implicit "type" of the column — it cannot be silently renamed to something that
loses the identity marker.

Drag-to-reorder: the Action column is excluded from the horizontal DnD sort. The
`useSortable` `disabled` prop for the column is set to `true` when `isActionCol`.
The column always stays at the rightmost position. The rationale: the Action
column is not a prompt; it represents an outcome and should always trail the
prompts visually. If the facilitator adds a new prompt column (via Add column),
the Action column stays rightmost because it is appended at board.columns end.
Store mutations that add columns must insert before the Action column, not after.

---

## Action card visual + back-pointer

**Primary affordance: inline muted source line (option b).**
**Secondary affordance: clickable to open source card modal (option c).**

Each Action card body renders normally. Below the body text, when
`card.sourceCardId` is set, a second line appears:

```
[card body text]
From: {source card body, truncated to 50 chars + ellipsis if longer}
```

The "From:" line uses a new `.action-card-source` class:

```css
.action-card-source {
  font-size: 11px;
  color: var(--fg4);
  line-height: 1.4;
  margin-top: 4px;
  cursor: pointer;
  text-decoration: none;
}
.action-card-source:hover {
  color: var(--fg2);
  text-decoration: underline;
  text-decoration-color: var(--fg4);
}
```

Clicking the "From:" line calls `onOpenDetails(card.sourceCardId, ...)`, opening
the source card's modal via the existing hash-routing mechanism
(`#card={sourceCardId}`). This is option (c) — deep-link to the source card.

Tooltip (title attribute) on the "From:" element: full source card body
(untruncated), for cases where the source body is longer than 50 chars.

**Why inline over tooltip-only:** The facilitator may share their screen after
the meeting. Tooltip-only is invisible unless someone hovers. Inline text is
always readable. The `--fg4` muted color keeps it subordinate to the action
item text without hiding it.

**Why not option (a) tooltip-only:** Same reason. The meeting closure moment is
when the Action column is most actively read; the back-pointer should not
require a hover gesture to be visible.

**Read-only boards:** The "From:" line still renders and still opens the source
card's modal (the modal renders in read-only mode). `onOpenDetails` is passed
even to read-only Action cards.

**Orphan case:** If the source card has been archived or deleted by the time the
Action card is rendered, `findCardOnBoard` will fail to resolve `sourceCardId`.
In that case the "From:" line falls back to: `From: (original card removed)` —
same `.action-card-source` class, same muted color, but not clickable (no
`cursor: pointer`, no hover underline). No `title` attribute.

---

## Action column behavior matrix

| Behavior | Enabled? | Notes |
|---|---|---|
| Voting on Action cards | NO | Vote button hidden. `isActionCol` prop passed to `Card`/`CardView`; when true, neither `VoteButton` nor the readOnly vote count span renders. Votes were cast on the source. Action cards are commitments, not proposals. |
| Editing card body | YES | Standard inline editing via kebab → Edit card. Same `onSaveCard` path. |
| Adding new cards manually | YES | Standard `"Add a card"` composer at the bottom of the column. Facilitator may add commitments not tied to any source card. These cards have `sourceCardId: undefined`. |
| Action items list inside Action card modal | NO | When the open card's column is the Action column, `.cd-action-items` section is hidden (`display: none`). Action cards don't recurse into sub-items. The `CardDetailsModal` receives an `isActionCard` boolean (or the caller can derive it from `card.sourceCardId` presence and column kind). Recommend passing `isActionCard` explicitly from `RetroApp` so the modal doesn't need board context. |
| Drag within Action column (reorder) | YES | Cards within the Action column can be reordered by drag. Standard within-column DnD. |
| Drag out of Action column | NO | Cross-column drag is blocked. Cards in the Action column cannot be dragged to prompt columns. The store's `moveCard` action should reject moves where `fromColKind === "action"` and `toColId` is a different column. |
| Drag into Action column | NO | Cards from prompt columns cannot be dragged into the Action column. Store rejects moves where `toColKind === "action"`. |
| Archive an Action card | YES | Standard archive (kebab → Archive, with F-22 undo toast). Consistent with all other cards. |
| Delete Action column | YES (owner only) | Via a new "Delete Action column" item in the column settings kebab — but only when the column is not in discussion mode. Since the Action column kebab is normally hidden, this entry point is a special case: a standalone `[Delete column]` button rendered only on the Action column header, in place of the kebab, visible only to owners on open boards. The existing `onRequestDeleteColumn` confirm path applies (if the column has cards, show the "Delete this column?" confirm modal). |

**Note on "Delete column" for the Action column:** The column kebab is hidden
(locked identity), but the facilitator must have an escape hatch. The
recommended approach is a minimal `[× Remove]` button (`.btn-subtle` tone,
`--fg4` color, no icon) rendered in the `.col-head` at the far right, replacing
the kebab. It triggers `onRequestDeleteColumn` exactly as the kebab does.
Alternatively, the kebab can remain but with only the Delete entry (Rename
removed). The developer should pick the simpler implementation; both are correct.

---

## F-20 export interaction

No code change required in F-20 or `exportRetro.ts`.

`exportActionItems` already reads `board.columns[board.columns.length - 1]` —
the rightmost column. After F-23, the rightmost column is reliably the Action
column when one has been built. The output is a flat bullet list of Action card
bodies plus their vote counts (all zero, since voting is disabled on Action
cards — this results in `(votes: 0)` on every line). The facilitator can strip
the vote annotations manually or they can be cleaned up in a later spec; this is
cosmetically suboptimal but not incorrect for v1.

The `sourceCardId` field is metadata only; it is not part of `card.body` and is
never included in the markdown output. That is the correct behavior — the export
is the commitment text, not the provenance chain.

One consequence to confirm with PO: if no rebuild has been run yet (the board
has no Action column), F-20's "Copy action items" exports whatever the current
rightmost column contains. This is the pre-existing behavior and is unchanged.

---

## Read-only state (closed board)

F-23 is unreachable on a closed board. Discussion mode itself is gated on
`!closed` in `RetroApp.tsx` (the "Start discussion" button is hidden when
`closed === true`; the discussion bar never mounts). Therefore "Finish
discussion" never fires on a closed board.

The Action column, once built, renders as a normal column in read-only mode:
cards visible, no vote buttons, no editing, no add-card composer, no kebab.
The "From:" back-pointer still renders and opens the source card's read-only
modal. No new code needed.

---

## Discussion-mode keyboard

Unchanged. ←/→ navigate between columns; Esc exits discussion mode without
rebuild. The Esc path continues to call `exitDiscussion()` directly, bypassing
`onFinishDiscussion`. This means Esc never triggers the Action column rebuild —
it is an emergency exit, not a graceful finish. This is the correct behavior:
the facilitator may exit mid-discussion and should not accidentally trigger a
rebuild that replaces an existing Action column.

The keyboard shortcut table in `ShortcutsCheatSheet.tsx` does not need updating:
discussion-mode navigation is already documented; "Finish discussion" is a button
action, not a keyboard shortcut.

---

## Toast feedback

All toasts use the existing `fireToast(msg)` from `_hooks/useToast`.

| Path | Copy | Undo? |
|---|---|---|
| Happy path, items found | `"Action column rebuilt — {N} items."` where N is the count of new Action cards | No |
| Empty path (no items captured) | `"No action items were captured."` | No |
| Cancel (confirm modal dismissed) | silent — no toast | — |

**Tone rationale:** Terse, factual. `"rebuilt — N items"` communicates the
action and the outcome in five words. No exclamation mark. Lowercase "items"
matches the existing microcopy register. N is the integer count of Action cards
created, not the count of source cards scanned.

Undo is not offered on the rebuild: the previous Action column state is replaced
and not snapshotted. Snapshotting an entire column (with potentially many cards)
for a 6-second undo window is disproportionate. The confirm modal is the
protection mechanism; the toast is confirmation only.

---

## Data model changes

### `Card.sourceCardId?: string`

New optional field on the `Card` type in `retro.ts`:

```ts
export type Card = {
  // ... existing fields ...
  sourceCardId?: string;
};
```

Optional because only Action column cards carry it. All prompt column cards,
manually-added Action column cards, and pre-existing cards have
`sourceCardId: undefined`. This keeps the type additive and backwards-compatible
— no migration needed for `sourceCardId` specifically.

F-MIGRATE does not need to handle `sourceCardId` unless it appears in stale
data. Since F-23 is the feature that sets it, and F-23 ships after F-MIGRATE in
the build sequence, there is no stale-data scenario.

### `Column.kind?: "action"`

New optional field on the `Column` type:

```ts
export type Column = {
  // ... existing fields ...
  kind?: "action";
};
```

**Justification for marker field over stable id:**

A stable id (`"action-col"`) is brittle if the user ever deletes and recreates
the column (the rebuilt column would get a new generated id, losing the stable
reference). A marker field on the Column object persists through id changes and
survives serialization without any special casing. It is also semantically
richer: a column is of kind "action," not merely named "action-col."

The marker approach also avoids treating the column's position as canonical
identity. The column is always appended at the end (rightmost), but position
is a rendering concern, not an identity concern. `kind === "action"` is the
single source of truth.

All existing columns have `kind: undefined`, which is falsy and requires no
migration.

The F-MIGRATE spec should add `kind` to the migration contract for completeness,
but since all pre-F-23 columns have `kind: undefined` by default (the field
simply doesn't exist yet), the migration is a no-op for this field.

### Store actions (not designed here — implementation notes only)

The following new store actions are needed (implementation is the developer's
scope, not this spec):

- `buildActionColumn(boardId, actionCards)` — creates or replaces the Action
  column. Creates with `{ id: crypto.randomUUID(), kind: "action", title: "Action",
  desc: "", cards: actionCards }` if it doesn't exist; replaces `cards` array in
  place if it does.
- `addColumn` must insert new columns before the Action column if one exists,
  not after. (Guard: if `board.columns[last].kind === "action"`, splice at
  `length - 1` rather than `length`.)
- `moveCard` must reject moves where `fromColumn.kind === "action"` and
  `toColumnId !== fromColumn.id`, and moves where `toColumn.kind === "action"`
  and `fromColumnId !== toColumn.id`.

---

## Microcopy bank

All new strings introduced by F-23:

| Surface | String |
|---|---|
| Discussion bar — button (last column) | `"Finish discussion"` (unchanged label; behavior changes) |
| Confirm modal — title | `"Rebuild Action column?"` |
| Confirm modal — body | `"The current action items will be replaced. This can't be undone."` |
| Confirm modal — cancel button | `"Cancel"` |
| Confirm modal — confirm button | `"Rebuild"` |
| Toast — happy path | `"Action column rebuilt — {N} items."` |
| Toast — empty path | `"No action items were captured."` |
| Action column — title | `"Action"` |
| Action column — delete affordance | `"Remove column"` (button on col-head; `.btn-subtle` tone) |
| Action column — delete affordance aria-label | `"Remove Action column"` |
| Card "From:" line — source present | `"From: {truncated source body}"` |
| Card "From:" line — source removed | `"From: (original card removed)"` |
| Card "From:" line — title attribute (tooltip) | Full source card body (untruncated) |
| Empty Action column hint | `"Nothing here yet."` (existing copy; no change) |
| Action card modal — action items section hidden | section is hidden, no replacement copy |

---

## CSS classes

### New classes

**`.col.action-col`**
Applied to the column wrapper when `col.kind === "action"`. Adds the indigo
top-border stripe:
```css
.col.action-col {
  border-top: 2px solid rgba(94, 106, 210, 0.6);
}
```
The `border-radius` on the top corners is already handled by the existing `.col`
rule (`border-radius: 10px`). The 2px top border sits inside the existing
`border: 1px solid var(--border-subtle)` — the top border overrides only the top
edge via specificity.

**`.action-card-source`**
Applied to the "From:" attribution line inside an Action card:
```css
.action-card-source {
  display: block;
  font-size: 11px;
  color: var(--fg4);
  line-height: 1.4;
  margin-top: 4px;
}
.action-card-source[data-clickable="true"] {
  cursor: pointer;
}
.action-card-source[data-clickable="true"]:hover {
  color: var(--fg2);
  text-decoration: underline;
  text-decoration-color: var(--fg4);
}
```

### Hidden section — Action items in Action card modal

When an Action card is open in `CardDetailsModal`, the `.cd-action-items` section
is hidden. This is achieved by passing `isActionCard={true}` to the modal and
rendering the section conditionally:

```jsx
{!isActionCard && (
  <section className={"cd-action-items" + ...}>…</section>
)}
```

No new CSS class needed. Conditional render is cleaner than a `.hidden` override
because it also suppresses the `ActionList` component mount entirely.

### No new tokens

All styling reuses existing tokens: `--brand-indigo` (at 60% opacity inline),
`--fg4`, `--fg2`. No new CSS custom properties are introduced.

---

## Out of scope

- Editing an Action card's body and having that change sync back to the source
  card's `actionItems` list (one-way flow only; backlog explicit).
- Ordering Action cards by priority after rebuild (deferred to v2).
- Timer or time-boxing per action item.
- Per-item assignee or due date on Action cards (backend-blocked).
- F-20 vote-count display cleanup (`(votes: 0)` on all Action cards) — cosmetic;
  deferred.
- Cross-retro Action column persistence or carry-forward to next sprint.
- Undo for the rebuild action (confirm modal is the protection; undo is
  disproportionate for a full column snapshot).
- F-MIGRATE migration logic for `sourceCardId` or `Column.kind` — both are
  additive; new fields default to `undefined` and require no migration.
