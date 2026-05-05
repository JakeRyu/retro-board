# F-24 — Workspace switcher (Selene / Eos)

> Date: 2026-05-05
> Depends on: nothing — additive

---

## Goal

Today the sidebar advertises a workspace concept (the "Atlas" mark + chevron at
the top) but it is decorative: the chevron does nothing, the name is hardcoded,
and there is no second workspace to switch to. Below it, the "Workspace" section
header carries vestigial Linear-pattern items (Inbox, Cycles) that were never
wired up and don't map onto the retro domain.

F-24 makes the workspace concept real: introduce two demo workspaces (Selene
and Eos) so that other teams using the retro board would each see their own
space, wire the chevron up to a working dropdown switcher that swaps the active
workspace, and clean out the dead Linear-pattern items so the sidebar's only
job is to show the active workspace and its retros.

---

## Why now

The handover doc and product vision both name "retro-board is the product;
kanban is mechanism, not a goal." The Atlas branding + Inbox/Cycles row are
direct holdovers from a Linear-style template that pre-dated the retro pivot.
Inbox (notifications/assignments) and Cycles (sprints) are project-management
artifacts, not retro artifacts. Removing them sharpens the surface; promoting
the workspace concept gives us a believable story for "another team also runs
retros here" without requiring any auth or backend.

This is intentionally a single-user-machine demo: workspaces are a partition
of the local boards list. There is no auth, no membership model, no per-user
view. Each workspace is a labelled bucket the user can switch between.

---

## Sidebar — final structure

Top to bottom, after F-24:

```
┌─ workspace switcher ────────┐
│ [S] Selene             ⌄    │   ← clickable: opens dropdown
└─────────────────────────────┘
  [🔍 Search]              ⌘K

  [📋 All retros]            5    ← single standalone item, no section header

  RETROS
    + Create retro
    • Sprint 24 — ADF refresh
    • Sprint 23 — pipeline cutover
    ...

  [you] You                  ⚙
```

Removed vs. today:
- "Workspace" section header (was line above Inbox/Boards/Cycles)
- "Inbox" item (decorative, fake count "3")
- "Cycles" item (decorative, fake count "2")
- "Retros" → "All retros" rename of the Boards link (the link still routes to
  `/`, but the label calls out the page's actual content)

Kept:
- Workspace switcher row at the top (functional now, name is dynamic)
- Search button (unchanged)
- "RETROS" section header + Create retro + scoped board list
- Footer (You + settings)

---

## Workspaces

Two seeded workspaces, hardcoded in `retro.ts`:

```ts
export const WORKSPACES: Workspace[] = [
  { id: "ws-selene", name: "Selene" },
  { id: "ws-eos",    name: "Eos" },
];
```

`Workspace.id` is the canonical identity, never the name. Names are user-facing
labels and could become editable later; `id` is what every `Board.workspaceId`
references.

**Default active:** `ws-selene` (Selene). Selene carries the historically-seeded
boards, so first-launch users land in a space that already has content.

**Mark glyph and color:** Each workspace renders its first-letter (uppercase) in
a small rounded square (`.ws-mark`). The background color is derived from the
workspace `id` by hashing it to an index in `BOARD_COLORS`:

```ts
function workspaceColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return BOARD_COLORS[Math.abs(h) % BOARD_COLORS.length];
}
```

This gives Selene and Eos stable distinct colors automatically; a future
third workspace gets one without manual assignment. The seed pair will produce
two visibly different palette colors with the deterministic hash above (verified
at implementation time by computing both indices).

The mark color is applied via inline style on the `.ws-mark` element so the
existing CSS class only carries shape and typography. No new CSS variable.

---

## Workspace switcher dropdown

**Trigger:** Pointerdown on the `.workspace` row (the entire row, not just the
chevron). Cursor on the row becomes `pointer` to advertise the affordance.

**Visual:** Same `.kebab-menu` pattern used elsewhere (BoardSettingsMenu, card
kebab). Anchored below the workspace row, full sidebar width minus 16px of
horizontal padding. Each item is a `.menu-item` row showing:

```
[mark] {workspace name}        ✓
```

The check (`Icon name="check"` or a simple unicode check, matching the existing
`.menu-item` register) appears only on the row matching the current
`activeWorkspaceId`. Hover state is the existing `.menu-item:hover` shading.

**Order:** Iteration order of `WORKSPACES` (Selene first, Eos second). No
sorting by activity or recency — the list is short and stable order helps
muscle memory.

**Selection:** Click on any item calls `storeActions.setActiveWorkspace(id)`.
- If the click is on the already-active workspace, the dropdown closes silently
  (no-op in store, no toast).
- If the click is on the other workspace, the active id flips and the dropdown
  closes. Sidebar and `/` page re-render against the new active id.

**Dismissal:**
- Click on a menu item (closes after selection).
- Click outside the workspace row + dropdown (`mousedown` listener, same
  pattern as `BoardSettingsMenu`).
- Esc keypress.

The trigger row's chevron icon rotates 180° while the dropdown is open
(`.workspace.open .ws-chevron { transform: rotate(180deg) }`) to signal the
toggle state. No new icon glyph.

**Accessibility:** The trigger row is a `<button type="button">` with
`aria-haspopup="menu"` and `aria-expanded`. The dropdown carries `role="menu"`
and each item carries `role="menuitem"`.

---

## Data model changes

### New `Workspace` type

```ts
export type Workspace = {
  id: string;
  name: string;
};
```

Two seeded constants exported from `retro.ts`:

```ts
export const WORKSPACES: Workspace[] = [
  { id: "ws-selene", name: "Selene" },
  { id: "ws-eos",    name: "Eos" },
];

export const DEFAULT_WORKSPACE_ID = "ws-selene";
```

### `Board.workspaceId: string`

Added to the `Board` type as a **required** field. Every seed board carries it
explicitly. Existing localStorage boards predate this field; on hydrate the
migrate function backfills `workspaceId = DEFAULT_WORKSPACE_ID`.

```ts
export type Board = {
  // ... existing fields ...
  workspaceId: string;
};
```

### Store shape

```ts
export type StoreState = {
  schemaVersion: number;
  boards: Board[];
  activeBoardId: string;
  activeWorkspaceId: string;   // new
};
```

`activeWorkspaceId` is also written into localStorage alongside boards. Same
debounced write path. No bump of `SCHEMA_VERSION` is strictly required because
the migrate function tolerates missing fields, but bumping it makes future
migrations cleaner — implementation may bump to `2` at its discretion.

**Initial value:** `DEFAULT_WORKSPACE_ID`. The hydrate path falls back to the
default if the persisted `activeWorkspaceId` references a workspace id that no
longer exists (defensive — only relevant if WORKSPACES is later trimmed).

### New store action

```ts
storeActions.setActiveWorkspace(id: string): void
```

- No-op when `id === state.activeWorkspaceId` (avoids spurious re-renders).
- Validates that `id` matches a known workspace id; otherwise no-op.
- Does NOT change `activeBoardId`. The active board may belong to a different
  workspace; that's fine because per-board pages render the board they were
  routed to regardless of workspace membership. The workspace concept gates
  list views (sidebar list, `/` tile view), not direct board URLs.

### `createBoard` change

The existing `createBoard` action assigns `workspaceId = state.activeWorkspaceId`
to the new board automatically. No change to the dialog UI — workspace is
implicit from the active state.

---

## Sidebar — implementation notes

`Sidebar.tsx` changes:

1. Read `activeWorkspaceId` from the store. Resolve against `WORKSPACES` to
   get the active workspace object; fall back to the first entry if not found.
2. Derive the mark glyph (first letter of name, uppercase) and mark color via
   the hash function.
3. Filter the retros list: `activeBoards.filter(b => b.workspaceId === activeWorkspaceId)`.
4. Wrap the `.workspace` row as a `<button>` and attach an open/close state.
5. Render the dropdown menu below the row, anchored to the row's bottom edge,
   using the existing `.kebab-menu` class plus a new `.workspace-menu` modifier
   for sidebar-specific positioning.
6. Remove the entire Workspace section block (lines around 62–77 in current
   `Sidebar.tsx`): the section header, Inbox div, and Cycles div. Move the
   `<Link>` to "/" out as a standalone `.side-item` directly under the search
   row, with no surrounding `.side-section` wrapper. Label changes from
   "Boards" → "All retros". The count remains
   `{filteredActiveBoards.length}`.

Click-outside dismissal uses the same pattern as `BoardSettingsMenu`:
`document.addEventListener("mousedown", ...)` checking that the event target is
not inside the wrapping ref. Esc dismissal uses a `keydown` listener.

---

## All retros page

`BoardsPage.tsx` is the `/` route's tile view. Today it consumes
`{ boards } = useStore()` and partitions the entire array. After F-24:

- Filter `boards` by `activeWorkspaceId` BEFORE partitioning.
- The page reactively re-renders when `activeWorkspaceId` changes (because
  `useStore` re-emits on every commit).
- The empty-state copy ("No retros yet.") fires when the active workspace has
  zero boards. The Create button on the empty state still creates inside the
  active workspace (existing `createBoard` path is sufficient).

No copy change to "Retros" page title — it remains the page label, and the
sidebar mark + name disambiguates which workspace is being viewed. (An
explicit "Retros — Selene" header would be redundant given the sidebar.)

---

## Switching behavior

When `setActiveWorkspace` is called:

- The sidebar list re-filters and re-renders.
- The `/` tile view re-filters and re-renders.
- `activeBoardId` is NOT changed. If the user is currently viewing a board
  page (`/boards/{id}`) that belongs to the other workspace, the board page
  continues to render (board pages route by id, not by workspace). This is
  intentional: the user clicked a board's URL, they should see that board
  regardless of which workspace they last sidebar-switched to.
- The next "Create retro" creates a board in the new active workspace.

---

## Seed data

All seed boards in `retro.ts` are replaced with new themed content. Counts:

**Selene (3 boards) — Azure Data Factory reporting:**
- Open + rich (1 board, 4 columns, ~12 cards with realistic ADF/reporting copy)
- Closed + sparse (1 board, no cards)
- Archived + sparse (1 board, no cards)

**Eos (2 boards) — new API project:**
- Open + rich (1 board, 4 columns, ~12 cards with realistic API-build copy)
- Closed + sparse (1 board, no cards)

The two rich boards demonstrate that workspaces hold real content; the closed
and archived sparse boards exercise the boards-page section partitioning
without inflating spec scope. The total seed payload is roughly 1.5× current.

The previous `SEED_BOARD` const is renamed conceptually but the export
`SEED_BOARD` (used as the activeBoardId fallback) is preserved as an alias
to the Selene rich board. `SEED_BOARDS` array now contains all 5 boards.

`board.id` strings: `b-seed-selene-1`, `b-seed-selene-2`, `b-seed-selene-3`,
`b-seed-eos-1`, `b-seed-eos-2`. Stable so cross-test references stay valid.

`USERS` array is unchanged: members are global across workspaces in v1. Per-
workspace membership is explicitly out of scope.

---

## Migration

`migrateBoard` in `store.ts` gains one more rule: if `b.workspaceId` is
missing or empty, set it to `DEFAULT_WORKSPACE_ID`. This is the only
backwards-compat path — every board the user already has in localStorage
becomes a Selene board on first hydrate after F-24.

Hydrate path also defaults `state.activeWorkspaceId` to `DEFAULT_WORKSPACE_ID`
when:
- The persisted payload has no `activeWorkspaceId` (pre-F-24 payload).
- The persisted `activeWorkspaceId` references a workspace not in `WORKSPACES`.

`SCHEMA_VERSION` may be bumped from 1 to 2 to signpost the new field set.
Bumping is optional because the migration is idempotent; implementation can
choose either way.

---

## Out of scope

- Per-workspace member roster (USERS stays global).
- Creating, renaming, or deleting workspaces from the UI (the two are
  hardcoded; "Add workspace" is deferred).
- Per-workspace styling beyond the mark color (no per-workspace theme,
  no per-workspace accent).
- Cross-workspace board moves ("move this retro to Eos").
- Workspace-aware search.
- Read-only awareness in the sidebar (no per-workspace read-only flag).
- Per-workspace auth, sharing, or invites.

---

## Microcopy bank

| Surface | String |
|---|---|
| Workspace switcher row — chevron tooltip | `Switch workspace` |
| Workspace dropdown — header label | none (list only) |
| Sidebar — single boards link | `All retros` |
| Boards page title (unchanged) | `Retros` |
| Empty-state copy (unchanged) | `No retros yet.` / `Create your first retro to get started.` |
| Inbox / Cycles | removed entirely |
| Workspace section heading | removed entirely |

---

## CSS classes

### New / modified

**`.workspace` becomes interactive**
```css
.workspace {
  cursor: pointer;
  position: relative; /* anchor the dropdown */
}
.workspace:hover {
  background: var(--surface-02);
}
.workspace.open .ws-chevron {
  transform: rotate(180deg);
}
.ws-chevron {
  transition: transform 120ms ease;
}
```

**`.ws-mark` color now inline**
The existing `background: var(--brand-indigo)` rule is retained as a fallback,
but the rendered color comes from an inline `style={{ background: color }}` on
the element. This keeps the CSS palette-agnostic.

**`.workspace-menu`** (new)
Modifier on `.kebab-menu` for sidebar positioning:
```css
.workspace-menu {
  left: 8px;
  right: 8px;
  top: calc(100% - 4px);
}
.workspace-menu .menu-item {
  display: flex;
  gap: 8px;
  align-items: center;
}
.workspace-menu .menu-item-mark {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.workspace-menu .menu-item-check {
  margin-left: auto;
  color: var(--fg2);
}
```

No new CSS tokens.

---

## Acceptance checklist

- [ ] Sidebar shows the active workspace's name and color-coded mark.
- [ ] Clicking the workspace row opens a dropdown listing both workspaces with
      a check on the current one.
- [ ] Clicking the other workspace flips the active id; sidebar list and `/`
      tile view both re-filter immediately.
- [ ] Esc and click-outside both close the dropdown.
- [ ] "Boards" → "All retros" with a count of the active workspace's boards.
- [ ] Inbox, Cycles, and the "Workspace" section header are gone.
- [ ] "Create retro" produces a board in the active workspace; the new board
      appears in the sidebar list and on `/`.
- [ ] Reload preserves the active workspace.
- [ ] Existing localStorage boards (pre-F-24) all show under Selene after one
      hydrate.
- [ ] Per-board URL `/boards/{id}` continues to render boards regardless of
      which workspace is active in the sidebar.
