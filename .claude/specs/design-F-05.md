# F-05 — Column CRUD (add, rename, delete)

## 1. Feature recap

The board owner needs to shape the board to their workflow: add new columns, rename existing ones, and delete the ones they don't want. The `Add column` button already exists in the markup (`.add-col`) but is a no-op; the column header has a placeholder kebab (`.col-icon-btn`) with no menu attached. F-05 wires both up using inline-edit and popover-menu patterns already established elsewhere in the app, plus the existing `.modal` for the non-empty-delete confirm. Owner-gated per HANDOVER §4.1, but in v1 (no auth) every local user is treated as owner — the gate is wired so the backend swap is clean.

## 2. Visual layout

The feature touches three surfaces, all inside the existing `.board-area`:

```
[col-head: title · count · ........ · kebab▾]   ← kebab opens menu
                                       └─ menu: Rename / Delete
[col body unchanged]
…
[add-col button]   ← clicking inserts a new col at end, focuses its title
```

Confirm modal (non-empty delete) reuses `.modal-overlay` + `.modal`, identical visual to the existing close-board confirm in `RetroApp.tsx`.

## 3. All states

- **Default column header**: title + count, kebab faint (`--fg4`) opacity 0 until hover.
- **Hover column header**: kebab fades to opacity 1 (100ms); cursor over title becomes `text` (signaling click-to-edit).
- **Title editing**: title text is replaced in place by an `input` that inherits `.col-title` typography. Blue focus ring (1px `--brand-indigo`, 3px halo at 0.15 alpha) — match `.add-card-input:focus`. Width fills the title slot; count pip stays visible to its right.
- **Kebab open**: kebab stays opacity 1 while menu is open (use `aria-expanded="true"` selector, mirrors `.board-card-kebab`). Menu popover anchored under kebab, right-aligned to it.
- **Confirm modal open**: same dim + scale-in as close-board confirm.
- **Read-only (closed board)**: `.add-col` hidden (already handled by `!closed && !discussion` guard); kebab hidden on every column (already handled by `!readOnly`); clicking a title does **not** enter edit mode — title is plain text.
- **Discussion mode**: `.add-col` hidden (existing); kebab and inline title-edit also hidden — column structure should not mutate during a live discussion. (Cards still mutate per HANDOVER §4.3.)
- **New column just inserted**: column fades in (240ms) and its title is in edit mode with `New column` selected.

## 4. Interaction spec

### 4.1 Add column

- **Trigger**: click on the existing `.add-col` button at the end of `.board-area`.
- **Result**: a new column is inserted at the **end** of the column list with default title `New column`, empty `cards`, empty `desc`. The new column immediately enters **rename mode** with the placeholder `New column` pre-filled and **fully selected** (so the user just types to overwrite). Focus is on the input.
- **Keyboard**: `Enter` or blur saves the title. `Esc` cancels rename **but keeps the column** with title `New column` (the column itself is not undone — that's what F-22 undo will cover later; flag).
- **Empty-state body**: the new column's body shows the F-16 empty-column copy `Nothing here yet.` (muted, centered) under the `Add a card` button. **Dependency on F-16** — if F-16 hasn't shipped when F-05 lands, the dev should ship the muted-centered copy inline here as a stub, then F-16 promotes it to a shared component.
- **Microcopy**: button label unchanged (`+ Add column`). No toast on add (too chatty).
- **Scroll**: the board-area should scroll horizontally to bring the new column into view (`element.scrollIntoView({ inline: "end", behavior: "smooth" })`).

### 4.2 Rename column (inline edit)

- **Affordance**: **direct click on the column title** enters edit mode. Recommended over the hover-pencil pattern (HANDOVER §4.1, board title) because the column header is a small target and discoverability is preserved by the cursor change to `text` on hover. Cursor change is the affordance.
- **Trigger**: click `.col-title` (also: `Rename` from the kebab menu — see §4.3).
- **Result**:
  1. `.col-title` swaps to an `input` with `value = current title`.
  2. Input is auto-focused and **fully selected** (`select()`).
  3. `Enter` saves and exits edit mode.
  4. Blur saves and exits edit mode.
  5. `Esc` cancels — input restores to the previous title and exits edit mode.
- **Validation**:
  - Trim leading/trailing whitespace before save.
  - Max length 60 (per AC). Hard-cap via `maxLength={60}`; no error toast.
  - Empty after trim → **revert to previous title** silently. (No error state, no shake — stay calm.)
- **Microcopy**: no labels; the field is the title itself. No toast on save.

### 4.3 Kebab menu

- **Trigger**: click the existing `.col-icon-btn` (3-dot horizontal). Menu is a popover anchored just below it, right-aligned.
- **Items** (in order):
  1. **Rename** — closes menu, enters rename mode (same flow as §4.2).
  2. **Delete** — `.menu-item.danger` styling. Closes menu; if column empty, deletes immediately; if non-empty, opens confirm modal (§4.4).
- **"Add card to top"**: **leave for later.** Adding a card is already a one-click affordance at the column body's `Add a card` button; surfacing it again in the kebab adds noise without a meaningful win. Flag as open question Q1 if PO disagrees.
- **Keyboard**: `Esc` closes the menu and returns focus to the kebab. Arrow keys navigate items (same as `.board-card-menu`).
- **Click-outside**: closes the menu.

### 4.4 Delete column

- **Empty column** (cards.length === 0): delete instantly on `Delete` click. No confirm. No toast (F-22 will add an Undo toast later).
- **Non-empty column**: open confirm modal.
  - **Title**: `Delete this column?`
  - **Body** (interpolated, per HANDOVER §4.6 verbatim): `This column has {N} cards. Delete the column and all its cards?` Use the literal copy with `{N}` substituted; pluralize `cards` → `card` when N === 1.
  - **Actions**: `[ Cancel ]` (`.btn .btn-ghost`) and `[ Delete ]` (`.btn .btn-primary` with `.danger` modifier — see §7).
  - **Esc / overlay click**: cancels.
- **Animation**: deleted column fades + collapses width over 180ms (matches HANDOVER §4.4 column delete). Cards within do not animate individually — the whole column collapses as one unit.

## 5. Owner gate

- For v1, the gate is a single boolean `isOwner` derived from `board.ownerId === currentUserId`. With no auth, `currentUserId` defaults to the seeded `me` user, and seed boards have `ownerId: "me"` — so it's effectively always `true`.
- Hide the kebab when `!isOwner`. Hide `.add-col` when `!isOwner`. Block title click → edit when `!isOwner`.
- **Hook the dev should expose**: a `useIsOwner(board)` (or equivalent selector) so the backend swap is one-line.
- Closed-board read-only takes precedence: even an owner cannot rename/add/delete on a closed board.

## 6. Microcopy

| Place | Copy |
|---|---|
| Add-column button | `+ Add column` (unchanged) |
| New column default title | `New column` |
| Kebab menu — rename | `Rename` |
| Kebab menu — delete | `Delete` |
| Confirm modal title | `Delete this column?` |
| Confirm modal body | `This column has {N} cards. Delete the column and all its cards?` (singular: `1 card`) |
| Confirm modal cancel | `Cancel` |
| Confirm modal confirm | `Delete` |
| Empty-rename revert | (silent — no toast) |
| Add toast | (none) |
| Delete toast (empty) | (none in F-05; F-22 adds Undo) |

## 7. CSS tokens / classes

**Reuse, no new tokens needed for color/border/radii.**

- `.col-icon-btn` — already styled; no change.
- `.col-title` — used as edit-mode input target; needs a `.col-title.editing` or sibling `.col-title-input` class with: `background: var(--bg-surface); border: 1px solid var(--brand-indigo); border-radius: 4px; padding: 1px 5px; font: inherit; color: var(--fg1); outline: none; box-shadow: 0 0 0 3px rgba(94,106,210,0.15);` Width fills available header space. Mirror `.board-title-input` for consistency.
- `.col-title { cursor: text; }` when owner + open (signal click-to-edit). Closed/non-owner: `cursor: default`.
- **New: `.col-kebab-menu`** — a thin alias of `.kebab-menu` (already defined) anchored to the column header. Reuse `.kebab-menu` directly if the existing absolute positioning works in the col-head context; otherwise introduce `.col-kebab-menu` with `position: absolute; top: 28px; right: 6px; min-width: 140px;` and the same surface/border/shadow as `.kebab-menu`. Items use `.menu-item` and `.menu-item.danger`.
- **Delete button danger variant**: existing `.btn-primary` is indigo. For destructive primary actions, propose **`.btn-primary.danger`** (or new `.btn-danger`) with `background: #d97777` (matching `.menu-item.danger` color) and `color: #fff`. Consistent with the close-board confirm currently using indigo for "Close board" — flag Q2 below.

No new design tokens; reuses `--brand-indigo`, `--fg1/2/3/4`, `--surface-*`, `--border-*`.

## 8. PO decisions

- **D1 (was Q1) — No `Add card to top` in kebab for v1.** Agreed with Designer: redundant with the column body's `Add a card` affordance. Revisit only if user research surfaces a real top-of-column workflow. Do not implement.
- **D2 (was Q2) — Introduce `.btn-danger` for destructive confirms; use it on the F-05 delete confirm.** Clarity beats consistency-with-the-current-mistake: a destructive, non-undoable action (until F-22 ships) must read as destructive. Retroactively apply `.btn-danger` to the existing close-board confirm in `RetroApp.tsx` as part of F-05 (small scope creep, but the inconsistency would be worse). No backlog AC change — F-05's AC already references HANDOVER §4.6 copy and a confirm modal; styling is design's call.
- **D3 (was Q3) — Esc on fresh-add rename keeps the column with title `New column`.** Designer's spec stands. Rationale: the user clicked `+ Add column` deliberately; treating Esc as "undo the whole add" overloads Esc with two meanings (cancel-edit vs. cancel-create) and the user has no other way to discover that. True undo lands in F-22. The new column is left with the default title and the user can rename later via title-click or kebab → Rename.
- **D4 (was Q4) — Zero-column boards are allowed.** Deleting the last column is permitted; the resulting empty-board state is owned by F-16 (`No cards yet. Be the first — what's on your mind?` — though that copy assumes at least one column for the composer; F-16's spec must extend to handle the zero-column case with a "+ Add column" CTA centered in the board area). Filed as a note for F-16 design rather than a blocker for F-05. **F-05 backlog AC unchanged.**

### Backlog impact

No F-05 acceptance-criteria edits required — the four decisions are all interaction/visual specifics already covered by F-05's existing AC ("Deleting a non-empty column shows the confirm copy …", "Owner-gated …", inline-edit pattern). D4 surfaces a small note for **F-16** (zero-column empty-board variant); not blocking F-05.
