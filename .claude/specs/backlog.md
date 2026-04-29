# Retro Board — v1 Backlog

> Owner: Product Owner agent
> Date: 2026-04-29
> Scope: Frontend-only v1. State persisted to `localStorage` until backend lands.
> Source-of-truth read: HANDOVER.md, AGENTS.md, app/_data/retro.ts, app/_components/*.

---

## Rationale & vision shift

The current product is a **single hi-fi retro board** that lives at the app root. The user has asked us to take it from "one nicely-painted board" to "a working kanban product with retros as a first-class mode." That requires three big shifts:

1. **From one board to many.** A boards list page becomes the home. The current single-board surface becomes `/boards/[id]`. Sidebar's "Retros" list becomes a real navigation.
2. **From retro-only to dual-purpose.** Cards gain Trello-style depth (description, comments, checklist, due date, labels, members). Retros keep their voting/anonymous/discussion behaviors as a *mode* on top of the kanban surface — not a replacement for it. Retro UX must not regress.
3. **Persistence without backend.** All multi-board, multi-card state moves to `localStorage`. Realtime, presence, members-as-real-users, and sharing are deferred to v2 when a backend exists.

### Tradeoffs taken
- **Cut hard on Trello bloat.** No attachments, no cover images, no board backgrounds, no power-ups, no email-to-board, no copy-board, no templates marketplace. These are <1×/session features.
- **Drag-and-drop is P0.** A kanban without DnD is not a kanban. This blocks most other card features.
- **Members are local stubs.** "Assigned to" picks from the seeded USERS list; invitations are deferred. Same for presence.
- **Discussion mode and voting stay retro-only.** They're hidden on non-retro boards — surfaced via a board-type flag chosen at creation.
- **Search is per-board, not cross-workspace.** Cross-board search needs a real index; not worth it for localStorage v1.

### Assumptions (flagged so they can be challenged)
- **Most users will create <20 boards.** localStorage cap (~5MB) is fine.
- **Single user per browser.** No multi-user merging needed in v1; "members" are decorative until backend.
- **A board has exactly one type — kanban OR retro — chosen at creation.** Switching type later is out of scope.

---

## Backlog

### F-01 — Multi-board data model + localStorage persistence

- **User story:** As a user, I want my boards and their contents to survive a page refresh, so that the app feels like a real tool and not a demo.
- **Why in scope:** Every other feature in this backlog needs more than one board and needs state to persist. This is the foundation.
- **Priority:** P0
- **Dependencies:** none
- **Acceptance criteria:**
  - Data model expands `Board` to include `id`, `type: "kanban" | "retro"`, `createdAt`, `updatedAt`, `archivedAt?`, `starred: boolean`, and owns its own `columns: Column[]`.
  - `Card` type expands with optional `description`, `comments[]`, `checklist[]`, `dueDate?`, `labels[]`, `assigneeIds[]`, `archivedAt?`. (Existing retro fields `voters`, `authorId` stay.)
  - All reads/writes go through a single store module (e.g. `app/_data/store.ts`) that hydrates from `localStorage` on mount and writes through on every mutation (debounced 300ms).
  - Seed data (current `COLUMNS` + `BOARD`) is inserted on first launch only.
  - Schema version stamp is stored so future migrations are possible.
- **Out of scope for v1:** server sync, conflict resolution, real users.
- **Backend follow-up:** swap `localStorage` driver for an API client; same store interface.

---

### F-02 — Boards list page (home)

- **User story:** As a user landing on the app, I want to see all my boards at a glance so I can jump into the one I need.
- **Why in scope:** The user explicitly asked for it. Without it, multi-board has no entry point.
- **Priority:** P0
- **Dependencies:** F-01
- **Acceptance criteria:**
  - Route `/` renders the boards list. The current board view moves to `/boards/[id]`.
  - Each board card shows: title, type badge (Kanban / Retro), card count, last-updated relative time, starred indicator, closed/archived state.
  - Boards are grouped: "Starred" → "Open" → "Closed" → "Archived" (Archived collapsed by default).
  - Clicking a board navigates to its detail page.
  - Empty state: "No boards yet. Create one to get started." with primary CTA.
  - Sidebar "Boards" item links here; sidebar "Retros" list filters to retro-type boards.
- **Out of scope for v1:** team/workspace switching, board sharing UI.

---

### F-03 — Create-board dialog

- **User story:** As a user, I want to create a new board by giving it a name and picking its type, so I can start working immediately.
- **Why in scope:** The user explicitly asked for it. Required for F-02 to have any boards beyond seed.
- **Priority:** P0
- **Dependencies:** F-01, F-02
- **Acceptance criteria:**
  - "Create board" CTA on boards list and in sidebar opens a modal dialog.
  - Fields: title (required), type (Kanban / Retro, segmented control, default Kanban), retro-only theme prompt (visible only when Retro chosen).
  - On submit: new board is created with default columns. Kanban default = `To do / In progress / Done`. Retro default = `What went well / What didn't / Try next time / Shout-outs`.
  - Submit navigates to the new board's detail page.
  - Esc / overlay click cancels; Enter on the title input submits.
  - Validation: title ≥ 1 char, ≤ 80 chars, trimmed.
- **Out of scope for v1:** templates beyond the two defaults, importing from Trello, copying an existing board.

---

### F-04 — Board routing + per-board view shell

- **User story:** As a user, I want each board to have its own URL so I can bookmark it, share it, and use the back button.
- **Why in scope:** Required to move beyond the single-route prototype. Trivial code-wise but unblocks F-02/F-03.
- **Priority:** P0
- **Dependencies:** F-01
- **Acceptance criteria:**
  - Route `/boards/[id]` renders the existing `RetroApp` surface for that board.
  - Unknown id shows a "Board not found" state with link back to boards list.
  - Title in topbar reflects the loaded board, not a constant.
  - Browser back/forward works between list and board.
- **Out of scope for v1:** deep links to specific cards.

---

### F-05 — Column CRUD (add, rename, delete)

- **User story:** As a board owner, I want to add, rename, and delete columns so I can shape the board to my workflow.
- **Why in scope:** HANDOVER.md §5 calls this out as missing. The "Add column" button already exists but is non-functional; column kebab is a placeholder.
- **Priority:** P0
- **Dependencies:** F-01
- **Acceptance criteria:**
  - Clicking "Add column" inserts a new column at the end and immediately puts its title into edit mode.
  - Column header has a kebab menu with: Rename, Delete.
  - Rename uses the same inline-edit pattern as the board title (Esc cancels, Enter/blur saves, ≤ 60 chars).
  - Deleting an empty column requires no confirm. Deleting a non-empty column shows the confirm copy from HANDOVER §4.6: *"This column has N cards. Delete the column and all its cards?"*
  - Owner-gated per HANDOVER §4.1. (For v1 with no real auth, "owner" = the local user; check still wired so backend swap is clean.)
- **Out of scope for v1:** column reordering by drag (covered in F-06), column color coding.

---

### F-06 — Drag-and-drop: cards within and between columns; column reorder

- **User story:** As a user, I want to drag cards between columns and reorder them, because that is how kanban boards work.
- **Why in scope:** Implied by "kanban." Without this the product is not a kanban board.
- **Priority:** P0
- **Dependencies:** F-01, F-05
- **Acceptance criteria:**
  - A card can be dragged within its column to reorder.
  - A card can be dragged into another column; it lands at the drop position, not always at the end.
  - During drag: source card shows a ghost/placeholder, drop targets highlight, autoscroll near board edges.
  - A column can be dragged horizontally to reorder among other columns (drag handle is the column header).
  - Keyboard accessibility: a focused card can be moved with `Ctrl/Cmd+Arrow` keys (up/down within column, left/right between columns).
  - Read-only state (closed board) disables DnD.
  - In retro discussion mode, DnD is disabled (sort-by-votes wins) — facilitator reorder is deferred per HANDOVER §4.3.
- **Out of scope for v1:** cross-board card move, multi-card drag, DnD on touch devices (mouse + keyboard only — touch deferred).

---

### F-07 — Card details modal

- **User story:** As a user, I want to click a card to open a richer view where I can add a description, checklist, comments, due date, labels, and assignees, so cards hold real work, not just a one-liner.
- **Why in scope:** This is the single most-used Trello surface. Without it cards are sticky notes.
- **Priority:** P0
- **Dependencies:** F-01
- **Acceptance criteria:**
  - Clicking the card body (not the kebab, not the vote button) opens a modal with the card's full state.
  - Sections: Title (inline edit), Description (markdown-light: line breaks + links rendered, no full markdown renderer), Checklist, Comments, Sidebar with Due date / Labels / Members / Archive.
  - Esc and overlay click close. URL hash updates to `#card=<id>` so the modal survives refresh and is shareable in-tab.
  - Edits are autosaved on blur; no explicit Save button.
  - In retro mode, vote button + voter avatars also appear in the modal header.
  - Read-only when board is closed: all controls disabled, content visible.
- **Out of scope for v1:** activity log, attachments, cover images, watching/subscribing, full markdown.

---

### F-08 — Card description (in modal)

- **User story:** As a user, I want to write a description on a card so I can capture the context, not just the headline.
- **Why in scope:** Trello's #1 card field by usage.
- **Priority:** P0
- **Dependencies:** F-07
- **Acceptance criteria:**
  - Multi-line textarea, autosizes up to ~12 rows then scrolls.
  - Empty state shows placeholder "Add a more detailed description…".
  - URLs are auto-linked on render (read mode).
  - Saved on blur; toast on save is suppressed (too chatty).
  - Card preview on the board shows a small "description" indicator icon when description is non-empty.

---

### F-09 — Card checklist

- **User story:** As a user, I want a checklist on a card so I can break work into checkable steps and see progress.
- **Why in scope:** High-frequency feature; pairs naturally with kanban "definition of done."
- **Priority:** P1
- **Dependencies:** F-07
- **Acceptance criteria:**
  - One checklist per card (multi-checklist deferred).
  - Add item, check/uncheck, edit text, delete item, reorder via drag handle.
  - Header shows "X / Y" complete; same indicator appears on the card preview when items > 0.
  - Completed items render struck-through; option to "Hide completed" inside the card modal.
- **Out of scope for v1:** assigning checklist items to people, due dates per item, multiple checklists.

---

### F-10 — Card due date

- **User story:** As a user, I want to set a due date on a card so I can plan and see what's overdue.
- **Why in scope:** Standard kanban field; cheap to implement.
- **Priority:** P1
- **Dependencies:** F-07
- **Acceptance criteria:**
  - Date picker in the card modal sidebar (no time-of-day in v1 — date only).
  - Card preview shows a date pill: neutral if future, warning if today, danger if overdue, muted if completed.
  - "Mark complete" toggle next to the date.
  - Clearable.
- **Out of scope for v1:** reminders/notifications, recurring due dates, time zones beyond local.

---

### F-11 — Card labels

- **User story:** As a user, I want to tag cards with labels so I can categorize and filter at a glance.
- **Why in scope:** Filtering (F-15) needs labels.
- **Priority:** P1
- **Dependencies:** F-07
- **Acceptance criteria:**
  - A board has a label set (default: 6 colored labels, no names).
  - In the card modal, "Labels" picker shows all board labels with a checkbox; user can also rename / add / delete labels (board-owner only).
  - Card preview shows label color stripes above the body, clipped to a max of 5.
  - Label color palette is fixed (6 colors) — picked from existing design tokens, no custom hex in v1.

---

### F-12 — Card members assigned

- **User story:** As a user, I want to assign a card to one or more members so it's clear who owns it.
- **Why in scope:** Standard kanban; pairs with filter by member.
- **Priority:** P1
- **Dependencies:** F-07
- **Acceptance criteria:**
  - Member picker in the card modal sidebar pulls from board members (v1: hardcoded `USERS` list).
  - Multiple assignees allowed.
  - Card preview shows assignee avatars (max 3, "+N" if more).
  - Filter-by-member (F-15) reads this field.
- **Out of scope for v1:** real invites; "members" are local stubs.
- **Backend follow-up:** real auth + invite flow.

---

### F-13 — Card comments

- **User story:** As a user, I want to comment on a card so discussion stays attached to the work.
- **Why in scope:** High-value, but currently single-user — so it's a P1 not a P0 (you're commenting to yourself for now).
- **Priority:** P1
- **Dependencies:** F-07
- **Acceptance criteria:**
  - Comment composer at the top of the comments section. Submit via Cmd/Ctrl+Enter.
  - Comments show author avatar, name, relative timestamp, body.
  - Edit and delete on own comments (kebab menu, same pattern as cards).
  - Comment count badge on card preview when > 0.
- **Out of scope for v1:** mentions, reactions, threading.

---

### F-14 — Card archive (and unarchive)

- **User story:** As a user, I want to archive cards I'm done with instead of deleting them, so I can clean up the board without losing history.
- **Why in scope:** Trello's lightweight "remove from view but keep" pattern; common request alongside delete.
- **Priority:** P1
- **Dependencies:** F-07
- **Acceptance criteria:**
  - "Archive" action in the card modal sidebar (and in card kebab menu).
  - Archived cards disappear from columns but appear in a per-board "Archived items" panel (accessible from board settings menu in topbar).
  - From the archive panel, user can unarchive (returns to last column position if it still exists, else to first column) or permanently delete.
  - Card delete (existing) becomes "Delete forever" and only appears in the archive panel; the kebab on a live card archives instead. (Migration note: existing "Delete" copy in HANDOVER §4.6 stays for the *permanent* delete in archive panel.)

---

### F-15 — Search and filter (per-board)

- **User story:** As a user, I want to filter the board by text, label, member, or due-date status so I can focus on a slice of the board.
- **Why in scope:** Once boards have >20 cards, scanning gets hard. Filters pay for themselves daily.
- **Priority:** P1
- **Dependencies:** F-11, F-12, F-10 (filters); F-01 (search across cards in current board)
- **Acceptance criteria:**
  - Topbar gains a "Filter" button → opens a popover with: text input, label multi-select, member multi-select, due-date status (none / overdue / due this week / completed).
  - Active filter shows a count badge; cards not matching are visually de-emphasized (not removed from layout, so column shape stays predictable). Toggle "Hide non-matching" in the popover removes them entirely.
  - "Clear all" resets.
  - In retro discussion mode, filtering is hidden (focus mode owns the screen).
- **Out of scope for v1:** cross-board search, saved filters, filter by date range.

---

### F-16 — Empty states (board, column)

- **User story:** As a user encountering an empty board or column, I want a friendly nudge that tells me what to do, so I'm not staring at nothing.
- **Why in scope:** Called out in HANDOVER §5; copy already exists in §4.6.
- **Priority:** P1
- **Dependencies:** F-05
- **Acceptance criteria:**
  - Empty board: "No cards yet. Be the first — what's on your mind?" with focus moved to the first column's "Add a card" composer.
  - Empty column: "Nothing here yet." muted, centered in the column body.
  - Empty boards list: covered by F-02.
  - Empty filter result: "No cards match your filter." with "Clear filter" link.

---

### F-17 — Board settings menu (rename theme, archive board, reopen)

- **User story:** As a board owner, I want a settings menu in the topbar where I can edit board-level things (theme, archive, reopen, view archived items, manage labels).
- **Why in scope:** A bunch of small actions need a home; without a menu they sprawl.
- **Priority:** P1
- **Dependencies:** F-02 (archive needs the list to surface it), F-11 (manage labels), F-14 (archived items panel)
- **Acceptance criteria:**
  - Topbar gains a kebab/settings menu next to Close board.
  - Items: Edit theme prompt (retro only), Manage labels, Archived items, Archive board, (if closed) Reopen board, (if archived) Unarchive board.
  - "Archive board" is a soft delete: board is removed from the open list but stays in the Archived group on the boards list, and can be unarchived.
  - Reopen toggles `state` from closed back to open (already half-implemented — currently closed is a one-way trip).

---

### F-18 — Star / favorite a board

- **User story:** As a user with many boards, I want to star the ones I work on daily so they sort to the top.
- **Why in scope:** Tiny feature, big quality-of-life payoff once F-02 has > 5 boards.
- **Priority:** P2
- **Dependencies:** F-02
- **Acceptance criteria:**
  - Star icon on each boards-list card and on each board's topbar.
  - Starred boards appear in their own "Starred" group on the list, ordered by most-recently-starred.
  - Sidebar "Retros" list shows starred retros first.

---

### F-19 — Keyboard shortcuts (global + board)

- **User story:** As a power user, I want keyboard shortcuts for the actions I use constantly so I don't have to mouse around.
- **Why in scope:** Cheap; matches the Linear-mood design language.
- **Priority:** P2
- **Dependencies:** F-02, F-07, F-15
- **Acceptance criteria:**
  - `c` from a board: focus the first column's "Add a card" composer.
  - `/` from a board: open filter popover with focus in text input.
  - `b` from anywhere: navigate to boards list.
  - `?`: opens a shortcuts cheat-sheet modal.
  - Existing discussion-mode keys (←/→/Esc) documented in the cheat-sheet.
  - Shortcuts disabled when an input/textarea is focused (except Esc).
- **Out of scope for v1:** customizing shortcuts.

---

### F-20 — Action items export (retro-only)

- **User story:** As a retro facilitator, I want to export the "Try next time" / action-item column as a list I can paste into Slack or a doc, so the takeaways don't die in the board.
- **Why in scope:** The single biggest miss in retro tooling — teams forget commitments. Cheap to add.
- **Priority:** P2
- **Dependencies:** F-01
- **Acceptance criteria:**
  - In retro boards, board-settings menu shows "Copy action items" → copies a markdown bulleted list of the cards in the rightmost column with vote count to clipboard.
  - Toast confirms.
  - Optional second action: "Copy full retro summary" → markdown grouped by column.
- **Out of scope for v1:** integrations (Slack, Linear, Jira); real export to file.

---

### F-21 — Realtime affordances polish (in-app only, single-user)

- **User story:** As a user, I want mutations to feel alive — fade-ins, pulses, smooth removals — so the board feels responsive instead of teleporting.
- **Why in scope:** HANDOVER §4.4 specifies these animations; they're independent of real backend (we already animate "newIds" for adds).
- **Priority:** P2
- **Dependencies:** F-05, F-07
- **Acceptance criteria:**
  - New-card pulse: already shipped; extended to cards added via DnD from another column.
  - Card-edit cross-fade on body change.
  - Card-delete collapse (height + opacity, 180ms).
  - Column add/delete fade.
  - Reduced-motion media query disables all of the above.
- **Out of scope for v1:** Lost-connection banner, "joined 2 min ago" presence tooltips, animations triggered by *other users* — these need a backend.
- **Backend follow-up:** wire the same animation hooks to incoming socket events.

---

### F-22 — Undo (recent destructive actions)

- **User story:** As a user who just deleted the wrong card, I want a one-click undo from the toast so I'm not punished for fast clicks.
- **Why in scope:** A delete confirm is *not* a substitute for undo. Trello has it. It's the difference between "I trust this app" and "I dread this app."
- **Priority:** P2
- **Dependencies:** F-01
- **Acceptance criteria:**
  - Card delete, card archive, column delete, board archive each show a toast with an "Undo" button visible for 6 seconds.
  - Undo restores the exact prior state (position, voters, etc.).
  - Once the toast expires, undo is gone (no global history panel in v1).
- **Out of scope for v1:** multi-step undo, undo across page refreshes.

---

### OUT — Explicitly cut from v1

| Feature | Why cut |
|---|---|
| Real members + invitations | Backend-blocked; stub assignees from local USERS instead (F-12). |
| Cross-board search | Needs an index; per-board search (F-15) covers 90% of use. |
| Card attachments / cover images | Storage-blocked; low frequency; bloat. |
| Board background customization | Pure decoration; doesn't move the product. |
| Board templates marketplace | Two defaults in F-03 are enough. |
| Card watching / subscribe / activity log | Multi-user feature; meaningless single-user. |
| Discussion mode Variant B (spotlight) | Already cut in design (HANDOVER §4.3). |
| Anonymous mode for non-retro boards | Not requested; retro-specific. |
| Power-ups / integrations | Out of v1 entirely. |
| Touch DnD | Needs different interaction model; defer. |
| Lost-connection banner | Needs backend. |
| Presence "+N" with real users | Needs backend. |
| Copy / move board across workspaces | No workspaces yet. |
| Multi-checklist per card | Single checklist (F-09) covers normal use. |
| Reminders / notifications | Backend-blocked. |
| Mentions in comments | Needs real users. |

---

## Build sequence

Order respects dependencies. Each step is a single Designer→Developer cycle.

1. **F-01** — multi-board data model + localStorage persistence *(foundation; nothing else works without it)*
2. **F-04** — board routing + per-board view shell *(unblocks the list page)*
3. **F-02** — boards list page
4. **F-03** — create-board dialog
5. **F-05** — column CRUD
6. **F-16** — empty states *(cheap; pairs naturally with F-05; lands while column code is fresh)*
7. **F-06** — drag-and-drop (cards + columns)
8. **F-07** — card details modal *(shell only; sub-features land next)*
9. **F-08** — card description
10. **F-11** — card labels *(needed before F-15 filter)*
11. **F-12** — card members assigned *(also needed before F-15)*
12. **F-10** — card due date *(also needed before F-15)*
13. **F-09** — card checklist
14. **F-13** — card comments
15. **F-14** — card archive
16. **F-15** — search and filter
17. **F-17** — board settings menu *(needs F-11, F-14 to have things to surface)*
18. **F-18** — star / favorite a board
19. **F-22** — undo on destructive actions *(touches several flows; lands once they exist)*
20. **F-19** — keyboard shortcuts
21. **F-20** — action items export
22. **F-21** — realtime affordances polish *(final pass; depends on most surfaces existing)*

End of v1 = F-22. v2 begins when backend is introduced; revisit OUT list at that point.
