# Retro Board — v1 Backlog (revised)

> Owner: Product Owner agent
> Date: 2026-05-01
> Scope: Frontend-only v1. State persisted to `localStorage` until backend lands.
> Audit source: approved audit 2026-05-01 (per-feature dispositions used throughout).

---

## Vision correction

The previous version of this backlog reframed the product as "a working kanban product with retros as a first-class mode" and shipped F-01 through F-22 along that frame — adding Trello-like surfaces (comments, labels, due dates, members, archive, search/filter) that have no role in a retrospective meeting. That framing was wrong. The product is, and always was, a **retro board**. The kanban-like structure — columns, cards, drag-and-drop — is the mechanism that makes retros feel tactile and collaborative; it is not a product surface to build out. This backlog corrects course: it removes the kanban-only features via explicit cleanup work, reframes the checklist as an action-item list, and introduces F-23 to close the action-items loop.

---

## Part 1 — Shipped features (KEEP / KEEP-AS-MECHANIC)

The following features shipped in F-01 through F-22 and are **accepted as-is** under the retro-only lens. No further work required except where noted in Part 2 (cleanup) or Part 3 (new work).

| F | Feature | Status |
|---|---|---|
| F-01 | Multi-board data model + localStorage persistence | Keep. `Board.type` collapses to constant once kanban seed data is removed (Part 2). |
| F-02 | Boards list page | Keep, reframed as **Retros list**. Drop type badge, drop Kanban grouping, rename "Boards" → "Retros" in sidebar and page heading. |
| F-03 | Create-board dialog | Keep, reframed as **Create retro**. Drop type segmented control; retro is the only type. Drop kanban default columns. |
| F-04 | Per-board routing | Keep. Optional route rename `/boards/[id]` → `/retros/[id]` deferred to backend integration. |
| F-05 | Column CRUD | Keep as mechanic. Facilitator may add or rename a prompt column. |
| F-06 | Drag-and-drop (reduced) | Keep card-DnD within and between columns. **Drop**: column-reorder drag, `Ctrl/Cmd+Arrow` keyboard DnD for columns. |
| F-07 | Card details modal (minimal) | Keep. Holds: title (edit) + voters + description + action list only. All other sections removed in Part 2. |
| F-08 | Card description | Keep. Drop description-icon indicator on card preview (visual noise). |
| F-16 | Empty states | Keep. Remove "Empty filter result" copy when F-15 filter UI is deleted. |
| F-14 | Card archive (and unarchive) | Keep. The card details modal stays (for description + action list), so Archive/Unarchive lives naturally there. The recoverability of unarchive is a real retro safety net. |
| F-17 | Board settings menu (slimmed) | Keep for: edit theme prompt, archive retro, reopen, Archived items. **Drop**: Manage labels entry. |
| F-18 | Star / favorite | Keep. Teams pin their recurring retro. |
| F-19 | Keyboard shortcuts (trimmed) | Keep `c`, `b`, `?`, discussion-mode arrows. **Drop** `/` (filter shortcut goes with F-15). Update cheat-sheet. |
| F-20 | Action items export | Keep. Input changes: now exports the auto-built **Action** column produced by F-23, not a hardcoded rightmost column. |
| F-21 | Realtime affordances | Keep. |
| F-22 | Undo on destructive actions | Keep. Covers archive (F-14), column delete, board archive. Card "delete forever" from the archive panel is the only path that bypasses undo, by design. |

---

## Part 2 — Cleanup (REMOVE)

These features are pure kanban-product additions with no role in a retro meeting. They must be **deleted** — not hidden, not feature-flagged — because their data fields and store mutations accumulate technical debt in every future retro feature. Each cleanup item ships as part of v1. The acceptance criteria describe the end state after cleanup.

---

### F-15-RM — Remove search and filter

- **User story:** As a retro participant, I want a focused board UI without a filter bar I will never use, so the retro surface stays clean.
- **Why removing serves the user:** Retros have 20–50 cards at most; with labels, members, and due dates gone, the filter has no dimensions. The topbar Filter button is dead weight.
- **Files touched:** `FilterPopover.tsx` (delete), `cardMatchesFilter.ts` (delete), `RetroApp.tsx` (remove Filter button and filter state wiring), `KeyboardShortcuts.tsx` or equivalent (remove `/` shortcut binding).
- **Priority:** P0 (cleanup)
- **Acceptance criteria:**
  - `FilterPopover.tsx` and `cardMatchesFilter.ts` are deleted.
  - No Filter button appears in the topbar.
  - The `/` keyboard shortcut no longer triggers a filter popover.
  - The cheat-sheet modal does not list `/`.
  - All cards in all columns are always visible (no filter state remains in the component or store).
  - No TypeScript errors introduced.
- **Out of scope:** Replacing filter with any other search mechanism.

---

### F-13-RM — Remove card comments

- **User story:** As a retro participant, I want discussion to happen in the room (via discussion mode), not in an async comment thread that nobody reads.
- **Why removing serves the user:** Discussion mode is the conversation surface. Comment threads are a kanban-async pattern that contradicts the synchronous retro meeting format.
- **Files touched:** `Comments.tsx` (delete), `CardDetailsModal.tsx` (remove comments section and `comments` prop wiring), `store.ts` (remove `addComment`, `editComment`, `deleteComment` mutations — verify exact names), `retro.ts` (remove `Comment` type and `Card.comments` field).
- **Priority:** P0 (cleanup)
- **Acceptance criteria:**
  - `Comments.tsx` is deleted.
  - `Comment` type is removed from `retro.ts`.
  - `Card.comments` field is removed from the `Card` type.
  - All comment-related store mutations are removed.
  - Card details modal contains no comments section, no comment count, no comment composer.
  - Card preview shows no comment count badge.
  - localStorage migration (Part 2 final step) silently drops any persisted `comments` arrays.
- **Out of scope:** Any replacement async discussion mechanism.

---

### F-12-RM — Remove card members (assignees)

- **User story:** As a retro participant, I want voter avatars to be the only participation signal on a sticky, so the card stays readable and focused on the idea.
- **Why removing serves the user:** Assignment is a task-ownership pattern. In a retro, the card represents a shared observation, not a task. Voter avatars already show who resonated with it.
- **Files touched:** `Members.tsx` (delete), `CardDetailsModal.tsx` (remove members section), `store.ts` (remove `toggleCardAssignee` mutation), `retro.ts` (remove `Card.assigneeIds` field), `Card.tsx` (remove assignee avatar stack on card preview).
- **Priority:** P0 (cleanup)
- **Acceptance criteria:**
  - `Members.tsx` is deleted.
  - `Card.assigneeIds` is removed from the `Card` type.
  - `toggleCardAssignee` is removed from the store.
  - Card preview renders no assignee avatars.
  - Card details modal contains no members/assignee picker.
  - localStorage migration silently drops any persisted `assigneeIds` values.
- **Out of scope:** Any future facilitator-assignment feature (deferred, requires design).

---

### F-11-RM — Remove card labels

- **User story:** As a retro participant, I want to categorize my stickies by which column I place them in — not by a label system I have to configure — so setup friction stays near zero.
- **Why removing serves the user:** The column prompt is the category. Labels duplicate that signal while adding configuration overhead. User-confirmed removal.
- **Files touched:** `Labels.tsx` (delete), `CardDetailsModal.tsx` (remove labels section), `BoardSettingsMenu.tsx` (remove Manage labels entry), `store.ts` (remove `addLabel`, `updateLabel`, `deleteLabel`, `toggleCardLabel` mutations), `retro.ts` (remove `Label` type, `Card.labels` field, `Board.labels` field, `defaultLabels()` function, `BOARD_COLOR_NAMES` constant), `Card.tsx` (remove label color stripes on card preview).
- **Priority:** P0 (cleanup)
- **Acceptance criteria:**
  - `Labels.tsx` is deleted.
  - `Label` type, `defaultLabels()`, `BOARD_COLOR_NAMES` are removed from `retro.ts`.
  - `Card.labels` and `Board.labels` are removed from their respective types.
  - All label store mutations are removed.
  - Card preview shows no label stripes.
  - Board settings menu has no Manage labels entry.
  - `SEED_BOARD` and all other seed boards no longer include a `labels` field.
  - localStorage migration silently drops any persisted `labels` arrays on boards and cards.
- **Out of scope:** Any future tagging or theming system.

---

### F-10-RM — Remove card due date

- **User story:** As a retro participant, I want stickies to capture observations in the moment — not carry scheduling baggage — so the board stays lightweight.
- **Why removing serves the user:** Stickies in a retro meeting are observations, not tasks with deadlines.
- **Files touched:** `DueDate.tsx` (delete), `dueDateStatus.ts` (delete), `CardDetailsModal.tsx` (remove due date section from sidebar), `store.ts` (remove `setCardDueDate`, `toggleCardDueComplete` mutations), `retro.ts` (remove `Card.dueDate` and `Card.dueComplete` fields), `Card.tsx` (remove due-date pill on card preview).
- **Priority:** P0 (cleanup)
- **Acceptance criteria:**
  - `DueDate.tsx` and `dueDateStatus.ts` are deleted.
  - `Card.dueDate` and `Card.dueComplete` are removed from the `Card` type.
  - Both store mutations are removed.
  - Card preview shows no due-date pill.
  - Card details modal sidebar contains no due-date picker or complete toggle.
  - localStorage migration silently drops any persisted `dueDate`/`dueComplete` values.
- **Out of scope:** Sprint-deadline tracking (separate product concern).

---

### F-TYPE-RM — Type-gating cleanup + sidebar merge

- **User story:** As a developer maintaining this codebase, I want the ~15 `board.type === "retro"` guard clauses removed so there is one product surface with no dead code paths.
- **Why removing serves the product:** With kanban gone, every `board.type === "retro"` check is always true — dead code. The sidebar's separate "Boards" and "Retros" sections collapse into one "Retros" list.
- **Files touched:** `RetroApp.tsx` (remove all `board.type` conditional branches), `Sidebar.tsx` (merge Boards/Retros sections into single Retros list), `retro.ts` (remove `BoardType` union type; `Board.type` field becomes `"retro"` constant or is removed), `store.ts` (remove `type` from `CreateBoardInput`; `defaultColumnsFor()` always returns retro columns), seed boards (`SEED_BOARD_KANBAN` removed from `SEED_BOARDS`).
- **Priority:** P0 (cleanup)
- **Acceptance criteria:**
  - No `board.type === "retro"` (or `=== "kanban"`) comparisons remain in the codebase.
  - `BoardType` union is removed; `Board.type` is either a literal `"retro"` or absent.
  - `SEED_BOARD_KANBAN` is removed from `SEED_BOARDS`; the retro seed boards remain.
  - Sidebar shows a single "Retros" section. No "Boards" section.
  - Create dialog has no type selector; always creates a retro with the retro default columns.
  - No TypeScript errors introduced.
- **Out of scope:** Migrating existing kanban boards in localStorage (they will simply be ignored on next hydrate; migration step below handles the schema bump).

---

## Part 3 — New work

### F-09 — Action list (repurposed from checklist)

- **User story:** As a retro facilitator, I want to capture action items directly on the sticky being discussed, so commitments are tied to the observation that prompted them.
- **Why in scope:** The per-card checklist (shipped as F-09) is the right structural home — a list of text items attached to a card — but its meaning was wrong for a retro. Reframed as "Action items" captured during discussion mode, it becomes the raw material for F-23.
- **Priority:** P0
- **Dependencies:** F-07 (card details modal, already shipped but slimmed by cleanup above)
- **Acceptance criteria:**
  - The checklist section in the card details modal is relabeled "Action items." The add-item input placeholder reads "Add an action item…".
  - `ChecklistItem` type is renamed `ActionItem`; `Card.checklist` field is renamed `Card.actionItems`. Store mutations are renamed accordingly (`addActionItem`, `toggleActionItem`, `editActionItem`, `deleteActionItem`).
  - The per-card checklist progress badge on the card preview is removed (progress surfaces in the Action column, not on individual stickies).
  - The "Hide completed" toggle inside the modal is removed — action items in a retro context are not "completed" during the meeting itself; they flow to F-23.
  - In discussion mode, the action-items section in the card modal is highlighted or otherwise visually signaled as "the place to capture what this discussion produces."
  - `Checklist.tsx` is renamed `ActionList.tsx` (or equivalent); old name is removed.
  - localStorage migration renames `checklist` → `actionItems` on every card without data loss.
- **Out of scope for v1:** Per-item assignment to a team member, per-item due dates, multiple action lists per card.
- **Backend follow-up:** Action items will become first-class entities with assignee and due date once a backend exists.

---

### F-23 — Finish Discussion → Action column

- **User story:** As a retro facilitator, when I finish the discussion I want all the action items the team captured to appear automatically in an Action column, so nothing is lost and the team can see their commitments at a glance before we close.
- **Why in scope:** This closes the retro loop. The meeting produces observations (sticky columns) and commitments (action items). Without this feature, action items live buried inside card modals and are invisible to the team at the end of the meeting.
- **Priority:** P0
- **Dependencies:** F-09 (action list on cards), F-20 (export reads from the Action column)
- **Acceptance criteria:**
  - When the facilitator clicks "Finish discussion," the app creates (or replaces) a column titled "Action" at the rightmost position on the board.
  - Every action-list item from every card across all columns is gathered and each becomes its own card in the Action column. Order: by source column position, then by card vote count (desc) within each column, then by item order within the card.
  - Each Action card body is the action-item text. The card carries a back-pointer (stored in a new `sourceCardId` field) identifying the sticky it came from. The UI surface of that back-pointer (tooltip, small label, etc.) is a design decision — the PO only requires it to be present and accessible.
  - If the team re-enters discussion mode and clicks Finish discussion again, the Action column is rebuilt: existing Action column cards are replaced, not appended. A confirm prompt ("Rebuild Action column? This will replace the current action items.") is shown if the Action column already contains cards.
  - F-20 "Copy action items" exports the Action column. No behavior change to F-20 itself — it already targets the rightmost column.
  - If no action items were captured on any card, "Finish discussion" creates an empty Action column with the empty-state copy "No action items were captured." A toast informs the facilitator.
  - Discussion mode keyboard navigation (←/→/Esc) is not affected.
  - The Action column respects the read-only state when the board is closed.
- **Out of scope for v1:** Editing action items directly in the Action column and having those edits sync back to the source card's action list (one-way flow only). Ordering the Action column by priority. Timer or time-boxing per action item.
- **Backend follow-up:** Action items and Action column cards become persistent entities with assignee, due date, and status once a backend exists. F-20 export could integrate with Linear/Jira at that point.

---

### F-MIGRATE — localStorage schema bump + migration

- **User story:** As a returning user, I want my existing retro data to load correctly after the v1 cleanup ships, so I don't lose boards or cards I created before.
- **Why in scope:** The cleanup removes six data fields (`comments`, `labels` on boards and cards, `assigneeIds`, `dueDate`, `dueComplete`, `archivedAt`, `originColumnId`, `archivedCards`) and renames one (`checklist` → `actionItems`). Without a migration, stale localStorage will either crash or silently carry dead fields forever.
- **Priority:** P0
- **Dependencies:** All F-*-RM cleanup items, F-09 rename
- **Acceptance criteria:**
  - `SCHEMA_VERSION` is bumped (e.g., `1` → `2`).
  - On hydrate, if `schemaVersion < 2`, the migration function runs before the state is used:
    - Drops `comments` from all cards.
    - Drops `labels` from all boards and cards.
    - Drops `assigneeIds` from all cards.
    - Drops `dueDate` and `dueComplete` from all cards.
    - Renames `checklist` → `actionItems` on all cards.
    - Drops or ignores any board with `type === "kanban"` (retro boards are kept).
  - No user-visible data loss for the fields that are kept (`body`, `authorId`, `voters`, `description`, `actionItems`, board title/theme/state/starred).
  - Migration runs once; `schemaVersion` is written back immediately so it does not re-run.
  - If localStorage is absent or malformed, seed state is used as normal (existing behavior).
- **Out of scope for v1:** Surfacing a "Your data was migrated" notice to the user.

---

## Part 4 — REMOVED from v1 (full OUT list)

Features in the first block were removed in the cleanup work above (Part 2). Features in the second block were cut from the original backlog and remain cut.

### Removed in v1 cleanup (audit 2026-05-01)

| Feature | Rationale |
|---|---|
| F-10 Card due date | Out — kanban-product feature, removed in v1 cleanup per audit 2026-05-01 |
| F-11 Card labels | Out — kanban-product feature, removed in v1 cleanup per audit 2026-05-01 |
| F-12 Card members / assignees | Out — kanban-product feature, removed in v1 cleanup per audit 2026-05-01 |
| F-13 Card comments | Out — kanban-product feature, removed in v1 cleanup per audit 2026-05-01 |
| F-15 Search and filter | Out — kanban-product feature, removed in v1 cleanup per audit 2026-05-01 |

### Deferred (were already cut; remain cut)

| Feature | Why cut |
|---|---|
| Real members + invitations | Backend-blocked; no real auth in v1. |
| Cross-board / cross-retro search | Needs an index; per-retro scan is sufficient. |
| Card attachments | Storage-blocked; no role in a retro sticky. |
| Board background customization | Pure decoration. |
| Retro template marketplace | Four default columns cover most formats; templates deferred. |
| Card watching / subscribe / activity log | Multi-user, backend-blocked. |
| Discussion mode Variant B (spotlight) | Variant A adopted; B is wireframe-only. |
| Power-ups / integrations (Slack, Jira, Linear) | Backend-blocked for v1. |
| Touch drag-and-drop | Separate interaction model; deferred. |
| Lost-connection banner | Needs backend. |
| Presence "+N" with real users | Needs backend. |
| Multi-step undo / undo across refreshes | Out of scope; 6-second toast covers normal use. |
| Column reorder by drag | Dropped from F-06 (kanban polish, not retro need). |
| Keyboard DnD for columns (`Ctrl/Cmd+Arrow`) | Dropped from F-06 same reason. |
| Timer / time-boxing per card | Retro-relevant but low frequency; deferred to v2. |
| Anonymous mode for non-retro boards | N/A — there are no non-retro boards. |
| Retro themes ("4Ls", "Start/Stop/Continue") | Facilitator can name columns manually; template system deferred. |

---

## Build sequence (cleanup + new work)

All shipped work (F-01 through F-22, except items amended above) is already done. The remaining work is:

1. **F-15-RM** — filter removal (most isolated; no data dependencies on any retro flow)
2. **F-13-RM** — comments removal (isolated component + store mutations)
3. **F-12-RM** — members/assignees removal
4. **F-11-RM** — labels removal (touches card preview, board model, and settings menu)
5. **F-10-RM** — due date removal (touches card preview and card modal sidebar)
6. **F-TYPE-RM** — type-gating cleanup + sidebar merge (cross-cutting; do after component cleanup so there are no references to removed surfaces left to untangle)
7. **F-09** — action-list rename + modal relabel + card-preview badge removal
8. **F-23** — Finish Discussion → Action column (only net-new feature; builds directly on F-09)
9. **F-MIGRATE** — localStorage schema bump + migration (final step, after all type and field changes are stable)
