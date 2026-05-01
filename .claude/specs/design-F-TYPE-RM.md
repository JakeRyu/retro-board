# F-TYPE-RM — Type-gating cleanup + sidebar merge

## Goal

With kanban gone, every `board.type === "retro"` guard is always true — dead
code. Remove all branching on board type: collapse the sidebar into one
"Retros" section, strip the type segmented control from the create dialog,
remove the type badge from board cards, and delete `BoardType` and
`SEED_BOARD_KANBAN` entirely.

---

## Removed surfaces

- `board.type === "retro"` (and `=== "kanban"`) conditionals in `RetroApp.tsx`,
  `BoardSettingsMenu.tsx`, `CardDetailsModal.tsx`, `Sidebar.tsx`,
  `CreateBoardDialog.tsx`.
- The type segmented control (`<div class="segmented">`) in `CreateBoardDialog`.
- The `.theme-prompt-collapse` animated reveal wrapper — theme prompt is always
  visible; collapse animation and the `open` toggling class are removed.
- The `state-pill` type badge (`<span class={"state-pill " + board.type}>`) in
  `BoardCard`.
- `BoardType` union export from `retro.ts`.
- `type` field on `CreateBoardInput` in `store.ts`.
- `defaultColumnsFor(type)` branching — the kanban fallback path is removed;
  function becomes a plain factory returning the four retro columns (or is
  inlined and deleted if it has only one call site).
- `SEED_BOARD_KANBAN` constant and its entry in `SEED_BOARDS` array.
- `emptyKanbanColumns()` helper in `retro.ts` (used only by kanban seed boards).
- `isRetroRoute` / `boardsItemActive` logic in `Sidebar.tsx`.

---

## Sidebar after merge

The sidebar currently has two sections: "Workspace" (containing a "Boards"
nav item) and "Retros" (containing the per-retro list). After this cleanup:

- The "Boards" nav item in the Workspace section remains as-is. It links to `/`
  (the boards/retros list page) and its active state simplifies: it is active
  whenever `pathname === "/"` — the `isRetroRoute` conditional is gone.
- The "Retros" section heading stays "Retros".
- The `+ Create board` button label inside the Retros section becomes
  `+ Create retro`. The click handler is unchanged.
- The per-retro link list renders `boards.filter(b => !b.archivedAt)` directly
  (no `.filter(b => b.type === "retro")` needed — all boards are retros).
- Starred-first ordering is unchanged.
- `isRetroRoute` and `boardsItemActive` locals are deleted; the active check on
  the "Boards" nav item becomes `pathname === "/"` and the active check on each
  retro row becomes `b.id === activeBoardId`.

---

## Boards list page after type-badge removal

The `BoardsPage` heading text `"Boards"` becomes `"Retros"` (the `<h1>`
and the `+ Create board` button label become `"Retros"` and `"Create retro"`
respectively). The `partition()` function and the Starred / Open / Closed /
Archived section groupings are untouched.

In `BoardCard`, the `.board-card-meta` row currently reads:
```
<span class="state-pill {board.type}">{board.type}</span> · N cards
```
The type pill is removed entirely. The meta row becomes:
```
N cards
```
The `· ` separator between the pill and the count is also removed; the count
stands alone. The card layout is otherwise unchanged (color stripe, star,
title, state/time row at the bottom).

Empty state copy in `BoardsPage` currently reads: "Create one to get
started — kanban for ongoing work, retro for a team look-back." This becomes:
"Create your first retro to get started."

---

## Create dialog after segmented control removal

The "Type" field row (label + `.segmented` radiogroup) is deleted. The `type`
state variable, `onSegmentedKeyDown` handler, and all `type === "retro"` /
`type === "kanban"` branches inside the dialog are removed.

The theme prompt field becomes unconditionally visible and always enabled —
the `.theme-prompt-collapse` wrapper div and the `open` class toggling are
removed. The textarea `disabled`, `tabIndex`, and `aria-hidden` conditionals
are replaced with their always-enabled values (`disabled={submitting}`,
`tabIndex={0}`, no `aria-hidden`).

Dialog title `"Create a new board"` becomes `"Create retro"`. The submit
button label changes from `"Create board"` / `"Creating…"` to `"Create retro"`
/ `"Creating…"`.

`storeActions.createBoard(...)` call drops the `type` field from the input
object. The `theme: type === "retro" ? theme.trim() : ""` expression becomes
`theme: theme.trim()`.

Tab order after removal: Title → Theme prompt → Color swatches → Cancel →
Create retro. One step shorter than before (type control removed).

---

## RetroApp topbar simplifications

Three `board.type === "retro"` references exist in `RetroApp.tsx`:

1. `const crumbPrefix = board.type === "retro" ? "Retros" : "Boards";` →
   becomes `const crumbPrefix = "Retros";` (or the variable is inlined).

2. `onCopyActionItems={board.type === "retro" ? onCopyActionItems : undefined}`
   and `onCopyFullSummary={board.type === "retro" ? onCopyFullSummary : undefined}`
   in the `<BoardSettingsMenu>` call → both become unconditional:
   `onCopyActionItems={onCopyActionItems}` and
   `onCopyFullSummary={onCopyFullSummary}`.

3. `isRetro={board.type === "retro"}` passed to `<CardDetailsModal>` → the
   `isRetro` prop is removed from `CardDetailsModal`'s interface entirely (see
   next section). The call site drops the prop.

---

## BoardSettingsMenu simplifications

In `BoardSettingsMenu.tsx`:

- `const isRetro = board.type === "retro";` → delete this local.
- `const showEditTheme = isRetro && !closed && !archived;` → becomes
  `const showEditTheme = !closed && !archived;`.
- `const showExports = isRetro && !!onCopyActionItems && !!onCopyFullSummary;`
  → becomes `const showExports = !!onCopyActionItems && !!onCopyFullSummary;`.
- The `isRetro` guard in the comment header (`// F-20: retro-only exports`) can
  be updated to drop "retro-only".

In `CardDetailsModal.tsx`:

- The `isRetro: boolean` prop is removed from `CardDetailsModalProps`.
- `const showVoteRow = isRetro && !readOnly;` → becomes
  `const showVoteRow = !readOnly;`.

---

## Type system verdict

**Keep `Board.type` as a literal `"retro"` string, not removed.**

Reason: `board.type` is persisted in localStorage. Removing the field would
make the F-MIGRATE migration unable to identify and drop any lingering kanban
boards in existing payloads. With `type: "retro"` as a TypeScript literal type
(not a union), callers get no branching surface, the field stays in the
serialized shape as a migration anchor, and `BoardType` union is still deleted.

Concrete changes to `retro.ts`:
- `export type BoardType = "kanban" | "retro";` → **deleted**.
- `Board.type: BoardType` → `Board.type: "retro"`.
- All seed boards already carry `type: "retro"` (except `SEED_BOARD_KANBAN`
  which is removed); no seed edits needed beyond the kanban removal.

Concrete change to `store.ts`:
- `import { ..., BoardType, ... }` → remove `BoardType` from the import.
- `CreateBoardInput.type: BoardType` → **field removed entirely**.
- `defaultColumnsFor(type: BoardType)` → **function removed** (or signature
  simplified to `defaultColumns()`); always returns the four retro columns.
- In `createBoard`, `type: input.type` is removed from the `Board` object
  literal; `type: "retro"` is inlined as a constant.

---

## Seed data

- `SEED_BOARD_KANBAN` constant → **deleted**.
- `emptyKanbanColumns()` helper → **deleted** (only used by kanban seed boards;
  `SEED_BOARD_CLOSED` and `SEED_BOARD_ARCHIVED` must be given retro-appropriate
  column stubs or empty `[]`).
- `SEED_BOARDS` array → remove `SEED_BOARD_KANBAN` entry; array becomes
  `[SEED_BOARD, SEED_BOARD_CLOSED, SEED_BOARD_ARCHIVED]`.
- `SEED_BOARD_CLOSED.columns` and `SEED_BOARD_ARCHIVED.columns` currently call
  `emptyKanbanColumns()` — replace with `[]` (empty column array is valid for
  closed/archived retros; the board renders with an empty state).

---

## Microcopy sweep

User-facing strings to rename (code identifiers are not renamed):

| Location | Before | After |
|---|---|---|
| `BoardsPage` `<h1>` | "Boards" | "Retros" |
| `BoardsPage` `+ Create board` button | "Create board" | "Create retro" |
| `BoardsPage` empty state `<p>` | "Create one to get started — kanban for ongoing work, retro for a team look-back." | "Create your first retro to get started." |
| `CreateBoardDialog` `<h2>` | "Create a new board" | "Create retro" |
| `CreateBoardDialog` submit button | "Create board" / "Creating…" | "Create retro" / "Creating…" |
| `Sidebar` `+ Create board` row | "Create board" | "Create retro" |
| `BoardCard` `aria-label` on star button | "Star board" / "Unstar board" | "Star retro" / "Unstar retro" |
| `BoardCard` `aria-label` on kebab | "Board actions" | "Retro actions" |
| `BoardSettingsMenu` trigger | `aria-label="Board settings"` | `aria-label="Retro settings"` |
| `BoardSettingsMenu` items | "Reopen board" / "Archive board" / "Unarchive board" | "Reopen retro" / "Archive retro" / "Unarchive retro" |

Strings to grep and confirm removed:

- `"kanban"` — any user-facing string; `"Kanban"` in the segmented control is
  gone with the component.
- `"Create a new board"` — replaced.
- `"Create board"` — replaced in two locations.
- `"Board actions"` / `"Board settings"` — replaced.
- `"retro for a team look-back"` — gone with the empty-state copy.
- `"kanban for ongoing work"` — gone with the empty-state copy.

---

## CSS sweep

- `.state-pill.kanban` rule in `globals.css` → **delete**. The rule styled the
  type badge; the badge is removed from `BoardCard`.
- `.state-pill.retro` rule in `globals.css` → **delete**. Same reason.
- `.theme-prompt-collapse` class in `globals.css` → **delete** if the animated
  reveal is removed. The theme prompt `<div class="field">` is always rendered;
  no collapse wrapper is needed.
- No new CSS classes are introduced.

---

## Out of scope

- F-09 (action-list rename / `checklist` → `actionItems`).
- F-23 (Finish Discussion → Action column).
- F-MIGRATE (localStorage schema bump; kanban-board filtering lives there).
- `/boards/[id]` route rename to `/retros/[id]` — deferred to backend
  integration per backlog §F-04.
- Archive panel layout — F-14 kept; no changes.
- Column reorder drag — already deferred in F-06.
