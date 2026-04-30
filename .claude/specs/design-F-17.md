# F-17 — Board settings menu

## 1. Feature recap

A bunch of board-level actions accumulated across earlier features have no proper home: editing the retro theme prompt is buried in the inline theme bar; "Manage labels" only exists per-card via the modal sidebar; the F-14 archive panel ships with a temporary `View archived (N)` link below the board area; and "archive board" / "reopen" / "unarchive" have no UI at all (the close-board flow is one-way today). F-17 adds a single kebab-style settings popover next to the topbar's `Close board` button and rolls all of these into one menu, while keeping `Close board` as a fast quick-action for the common case.

## 2. Topbar layout

```
[crumbs · title · state-pill]   [presence] [filter] [anon] [Start discussion] [Close board] [⋯ settings]
```

- The settings trigger lives **right-most** in the topbar action cluster, after `Close board`. This keeps the most-frequent action (`Close board`) at thumb-distance and uses the standard "more" affordance (the kebab) for everything else.
- Trigger: `.board-settings-btn`, square 30×30, reuses the `.btn-icon` token shape (matches discussion-bar / archive-panel-head close button proportions). Glyph: three vertical dots — same custom inline SVG shape used by `BoardCard.KebabGlyph`, rotated to vertical so it visually anchors a "menu" rather than reading as a duplicate of the card-card kebab. Reuse the existing horizontal glyph if rotation is awkward; either reads as "more menu" in this slot.
- `aria-haspopup="menu"`, `aria-expanded`, `aria-label="Board settings"`. Tab-stops in document order so the menu lands after `Close board`.

## 3. Menu items (vary by board state)

The menu is rendered by a new `BoardSettingsMenu` component. Items shown are determined by:

- `isRetro = board.type === "retro"`
- `closed = board.state === "closed"`
- `archived = !!board.archivedAt`

| Item | Shown when | Notes |
|---|---|---|
| **Edit theme prompt** | retro && !closed && !archived | Opens inline modal (§4). |
| **Manage labels** | !closed && !archived | Opens labels modal (§5). |
| **Archived items (N)** | always | N = `board.archivedCards.length`. Even when zero (so users can confirm "nothing archived"). Opens `ArchivedItemsPanel`. |
| divider | when at least one of the next three appears | `.menu-divider`, 1px `--border-subtle`. |
| **Archive board** | !archived | Confirms then sets `archivedAt`. Soft delete. |
| **Reopen board** | closed && !archived | Flips `state` from `closed` → `open`. Toast "Board reopened." |
| **Unarchive board** | archived | Clears `archivedAt`. Toast "Board unarchived." |

`Archive board` is `.menu-item.danger`. `Reopen board` and `Unarchive board` are neutral. The remaining items are neutral.

Empty-menu impossibility check: `Archived items` is always shown so the menu is never empty — the trigger is always meaningful.

## 4. "Edit theme prompt" modal

- Reuses the standard `.modal-overlay` + `.modal` family (same width as the close-board confirm — 420px).
- Body: a single `<textarea>` pre-filled with `board.theme`. 4–8 rows, autosizes. `maxlength` not enforced (themes are commentary, not titles).
- Actions: `Cancel` (`.btn-ghost`) on the left, `Save` (`.btn-primary`) on the right.
- Esc closes (cancels). Enter inserts a newline (it's a textarea); Cmd/Ctrl+Enter submits. Focus moves to textarea on open and the existing value is selected so the common case (rewrite) is one keystroke.
- On save: `storeActions.setBoardTheme(boardId, value)` — new action, trims trailing whitespace, allows empty (a blank theme bar collapses cleanly already).
- Modifier `.modal.modal-edit-theme` for the slightly taller textarea height. No new tokens.

## 5. "Manage labels" modal

Reuses the F-11 `LabelPicker` component in a new "management" mode that hides the per-card checkbox column. New optional prop on `LabelPicker`:

```
manageOnly?: boolean   // when true: hide the .label-checkbox in each row; rest is unchanged
```

- Reuses `.modal-overlay` + `.modal`. Width 420px (matches the existing confirms). Title: `Manage labels`.
- Body is the picker. Read-only (closed/archived) doesn't apply because the menu item is hidden in those states.
- Actions row: just `Done` (`.btn-ghost`) — closes the modal. All edits autosave through the existing label store actions, so there's no Save semantic.
- Esc / overlay click closes (existing modal pattern, with the pointerdown-vs-click guard inherited from F-07/F-14).

## 6. "Archived items" entry point

- Menu item label: `Archived items (N)`. N is rendered inline; when zero the menu item still appears but is muted (`--fg4`) and reads `Archived items (0)`. Click opens the existing `ArchivedItemsPanel` overlay.
- F-14's temp `archived-link` button below the board area is removed. The `.archived-link` CSS rule is also removed.

## 7. Archive / reopen / unarchive flows

### Archive board
- Click → confirm modal: title `Archive this board?`, body `Archive this board? It moves to the Archived group on your boards list. You can unarchive any time.`, actions `Cancel` / `Archive` (`.btn-danger` since this hides it from the open list — irreversible-feeling enough to deserve red, even though it's recoverable).
- On confirm: `storeActions.archiveBoard(boardId)` → sets `archivedAt = now`. Then `router.push("/")` so the user lands on the boards list (where the board now appears in the Archived group from F-02).
- No toast — the navigation is the feedback.

### Reopen board
- Only shown when `state === "closed"` and not archived.
- Click → `storeActions.reopenBoard(boardId)` → sets `state = "open"`. No confirm — reopen is reversible (`Close board` is right there).
- Toast: `Board reopened.`

### Unarchive board
- Only shown when `archivedAt` is truthy.
- Click → `storeActions.unarchiveBoard(boardId)` → clears `archivedAt`. No confirm.
- Toast: `Board unarchived.`

## 8. State combinations

| Board state | Visible menu items |
|---|---|
| Open retro | Edit theme · Manage labels · Archived items (N) · — · Archive board |
| Open kanban | Manage labels · Archived items (N) · — · Archive board |
| Closed | Archived items (N) · — · Reopen board · Archive board |
| Archived | Archived items (N) · — · Unarchive board |

(Read-only board: theme/manage-labels/archive items entry hidden, since editing is off; Reopen is the way back.)

## 9. Owner gate

- Non-owners: `BoardSettingsMenu` returns `null`. The trigger is hidden entirely — no greyed-out menu.
- v1: `useIsOwner` returns `true` for everyone, so the trigger is always rendered. Wiring still goes through the hook so the backend swap is a one-line change.

## 10. Interaction / keyboard

- **Open menu**: click trigger or Enter/Space when focused. `aria-expanded` flips. Focus stays on trigger; arrow-down moves into first item (best-effort — defer to native focus order if implementation cost is high; in v1 the menu is short enough that mouse + Tab is fine).
- **Close menu**: Esc, click outside, click an item. Click-away uses the same mousedown listener pattern as `BoardCard`.
- **Item activation**: Enter / Space / click. After activation the menu closes immediately, *then* the item's modal/panel/confirm opens (one transition at a time — no nested z-index stack).
- **Modal Esc isolation**: `Edit theme` and `Manage labels` modals stop Esc propagation so closing the inner modal doesn't also close the menu (the menu is already closed by then anyway, but defensive).

## 11. Animations

- Menu fade: 100ms (matches existing `.kebab-menu` — instant feeling). No slide.
- Modals: existing 150ms fade + 4px slide.
- Archive-board → boards-list navigation: instant Next.js client navigation; no extra animation on the board side.

## 12. Edge cases

- **Board archived from another tab while the menu is open**: store update re-renders; the menu items rebuild and Archive board flips to Unarchive board next render. If a confirm modal was open it stays open and its Archive button no-ops (`archiveBoard` short-circuits when already archived). Acceptable — F-21 / F-22 own anything finer.
- **Close-board confirm + settings menu open at the same time**: not reachable because the menu closes on item click; the only way to trigger close-board at the same time as the menu is open is the sibling `Close board` button, and that single user click only opens one. We don't gate.
- **Empty theme**: saving an empty theme on a retro board collapses the theme bar to an empty body. Existing CSS handles it. Confirmed safe.
- **Boards list navigation during archive on `/boards/[id]` with the modal open**: confirm modal closes via state reset before `router.push`. Reset is implicit because `RetroApp` unmounts on route change.
- **Reopen on an already-open board** (shouldn't happen because the item is hidden): store action is idempotent — sets `state = "open"` even when already open. Defensive, matches `setBoardState` shape.

## 13. Microcopy

- Trigger `aria-label`: `Board settings`.
- Menu item labels (no trailing punctuation, sentence case): `Edit theme prompt`, `Manage labels`, `Archived items (N)`, `Archive board`, `Reopen board`, `Unarchive board`.
- Edit-theme modal title: `Edit theme prompt`. Save / Cancel buttons.
- Manage-labels modal title: `Manage labels`. Single `Done` button.
- Archive-board confirm title: `Archive this board?`. Body: `Archive this board? It moves to the Archived group on your boards list. You can unarchive any time.` Confirm button: `Archive`. Cancel: `Cancel`.
- Toasts: `Board reopened.` / `Board unarchived.` (no toast on archive — navigation is the signal.)

## 14. CSS — new / reused classes

Reused: `.btn-icon`, `.kebab-menu`, `.menu-item`, `.menu-item.danger`, `.modal-overlay`, `.modal`, `.btn-ghost`, `.btn-primary`, `.btn-danger`, `.label-picker`.

New / extended:

- `.board-settings-btn` — scoped on `.btn-icon` to give it a positioned wrapper (`.board-settings-wrap` with `position: relative`) so the menu can anchor under it.
- `.board-settings-wrap` — wraps button + popover; `position: relative`.
- `.board-settings-menu` — variant on `.kebab-menu` anchored top-right under the trigger: `top: 36px; right: 0; min-width: 220px;`. Rest inherits from `.kebab-menu`.
- `.menu-item-count` — small monospace counter for `Archived items (N)`: `margin-left: auto; font-family: var(--font-mono); font-size: 10px; color: var(--fg4);`.
- `.menu-divider` — `1px solid var(--border-subtle); margin: 4px 0;`.
- `.modal.modal-edit-theme` — variant on `.modal`, taller body region: `width: 480px;` to give the textarea room.
- `.edit-theme-textarea` — reuses `.cd-description-input` look (border, indigo focus halo) at min-height 96px.
- `.label-picker.manage-only .label-checkbox { display: none; }` — single rule turns the picker into management mode.

No new color tokens. No new icons (kebab glyph is inline SVG, same shape as `BoardCard.KebabGlyph`).

## 15. Open questions for PO

- **Should `Archived items` show N = 0 or be hidden when empty?** Spec keeps it visible for predictability ("the menu doesn't shapeshift"); easy to flip if PO disagrees.
- **Should `Archive board` show a toast with Undo (per F-22) instead of navigating away?** F-22 will own this; F-17 ships the bare navigation.
- **Edit theme on Kanban boards**: hidden today (theme is retro-only). If kanban ever grows a description, this menu has the slot.
