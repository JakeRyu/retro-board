# F-15 — Search and filter (per-board)

## 1. Feature recap

Once a board has more than ~20 cards, scanning gets hard. F-15 adds a per-board
filter popover anchored from the topbar that narrows the visible cards by
text, label, member, and due-date status. Non-matching cards stay in layout
at 0.3 opacity (so the column shape doesn't shift) unless the user toggles
"Hide non-matching", which removes them entirely. The filter is local
component state — not persisted, not cross-board, gone on navigate-away. In
retro discussion mode the filter is hidden entirely (focus mode owns the
screen). Read-only boards still let the user filter — the filter is a view
concern, not a mutation.

## 2. Surface — topbar Filter button

Lives in the right-side toolbar of `.topbar`, between the presence stack and
the Anonymous toggle. New element ordering:

```
[crumbs (left)] ........ [presence] [Filter] [Anonymous] [Start discussion] [Close board]
```

- Class `.filter-btn`. Visual base reuses `.anon-toggle` metrics (28px height,
  pill, 11px text) so the right-toolbar reads as one cohesive cluster — but
  with no switch glyph; just the filter icon + label.
- Active state (`data-active="true"` when any filter dimension is non-empty):
  `.filter-btn` swaps to indigo-tinted `--brand-violet-hi` text and indigo
  border (mirrors `.anon-toggle[data-on="true"]`).
- Active count badge (`.filter-btn-badge`): a tiny pill on the right of the
  button showing the number of *active dimensions* (text non-empty, label
  list non-empty, member list non-empty, dueStatus !== 'none' each count
  once). Caps at 9, then "9+". `display: none` when 0.
- Hidden when `discussion === true`. Visible regardless of `closed`.
- Aria: `aria-expanded` reflects open state; `aria-haspopup="dialog"`.

## 3. Surface — Filter popover

Anchored absolutely below the button (right-aligned to its right edge), 280px
wide. Class `.filter-popover`. Z-index above the topbar but below the
modal-overlay (e.g. 30). Open animation: instant — no slide/fade in v1
(matches the kebab menus already shipped).

Vertical stack of sections separated by a 1px `--border-subtle` divider:

```
┌─ .filter-popover ───────────────────┐
│ [text input  search…]               │  ← .filter-text-input
│ ─────────────────────────────────── │
│ Labels                              │  ← .filter-section-label
│ [☑] ░░░░ Frontend                   │  ← .filter-list-row
│ [ ] ░░░░ Backend                    │
│ ...                                 │
│ ─────────────────────────────────── │
│ Members                             │
│ [☑] ● You                           │
│ [ ] ● Maya                          │
│ ...                                 │
│ ─────────────────────────────────── │
│ Due date                            │
│ ( ) Any  (•) Overdue                │  ← .filter-due-options (radios)
│ ( ) Due this week  ( ) Completed    │
│ ─────────────────────────────────── │
│ [ ] Hide non-matching               │  ← .filter-section, toggle row
│ ─────────────────────────────────── │
│ [Clear all]                         │  ← .filter-actions
└─────────────────────────────────────┘
```

### 3.1 Text input
- Top of popover. `<input type="search" />`, autofocused on open.
- Placeholder: `Search cards…`.
- Filters case-insensitive substring across `card.body`, `card.description`,
  and every `card.comments[].body`. Whitespace-only text is treated as empty
  (no filtering applied).

### 3.2 Labels multi-select
- Heading `Labels` (`.filter-section-label`).
- One row per board label. Row anatomy = checkbox + 12×4 color stripe + name
  (or italic "Untitled" muted when empty).
- Click anywhere on the row toggles the checkbox.
- A card matches the labels dimension when **any** of its labels is in the
  selected set (OR). Empty selection = dimension inactive.
- Empty board.labels → section is hidden (no point showing an empty list).

### 3.3 Members multi-select
- Heading `Members`.
- One row per `USERS` entry. Row anatomy = checkbox + 18px Avatar + name.
- A card matches when **any** of its `assigneeIds` is in the selected set.
- Always shown (USERS is non-empty by construction).

### 3.4 Due date status
- Four radios in a 2-column grid (`.filter-due-options`):
  - `Any` (default) — dimension inactive.
  - `Overdue` — `dueDate < today AND dueComplete !== true`.
  - `Due this week` — `today <= dueDate <= today+6` AND `dueComplete !== true`.
  - `Completed` — `dueComplete === true` (regardless of date).
- "This week" = today inclusive, +6 days inclusive (covers a full 7-day
  window). Edge: a card with no `dueDate` cannot satisfy any of the three
  active options — it fails the dimension when one is selected.

### 3.5 Hide non-matching toggle
- Single checkbox row, label `Hide non-matching`. Default off.
- Off (default): non-matching cards render at 0.3 opacity, `pointer-events:
  auto` so they remain clickable (open modal etc.) — they're de-emphasized,
  not disabled. Column shape stays predictable.
- On: non-matching cards don't render at all. Empty columns surface their
  existing `.empty-column-hint` ("Nothing here yet.").

### 3.6 Clear all
- Single button `Clear all` at the bottom (`.btn .btn-subtle`). Resets all
  five fields to the empty state. Disabled when filter is already empty.

## 4. Filter logic

A card matches the active filter when **all active dimensions** match
(AND across dimensions, OR within multi-select dimensions). An "active
dimension" is one whose state is non-empty — empty text, empty label
selection, empty member selection, or `dueStatus === 'none'` are skipped.

If every dimension is inactive, every card matches — i.e. no filter is
applied. The active-count badge is 0 in that case and the popover button
loses its active styling.

The pure helper lives in `app/_lib/cardMatchesFilter.ts`:

```ts
export type FilterDueStatus = "none" | "overdue" | "thisWeek" | "completed";

export type BoardFilter = {
  text: string;
  labelIds: string[];
  memberIds: string[];
  dueStatus: FilterDueStatus;
  hideNonMatching: boolean;
};

export const EMPTY_FILTER: BoardFilter;

export function activeFilterDimensionCount(f: BoardFilter): number;
export function isFilterActive(f: BoardFilter): boolean;
export function cardMatchesFilter(card: Card, filter: BoardFilter): boolean;
```

`cardMatchesFilter` ignores `hideNonMatching` — that's a render concern, not
a logic concern. Today-comparison reuses the local-time YYYY-MM-DD pattern
from `dueDateStatus.ts` (see §6 of F-10 design).

## 5. Plumbing

- Filter state lives in `RetroAppLoaded`'s local state (`useState<BoardFilter>`).
  Reset to `EMPTY_FILTER` whenever `board.id` changes (use `useEffect` keyed
  on `board.id`). No persistence.
- `RetroApp` derives `filterActive = isFilterActive(filter)` and
  `cardMatches = (card) => cardMatchesFilter(card, filter)`. Passed down to
  `<Column>` via two new props: `filter` (so `Column` can consult it for
  hide-non-matching) and `cardMatches` (or pass the resolved booleans by
  computing in the column).
- `Column.tsx`: when `filter.hideNonMatching === true`, filter out
  non-matching cards before passing to `SortableContext` so DnD never
  resolves their ids. Otherwise render all cards but pass a `dimmed` flag
  down to `<Card>`.
- `Card.tsx`: a new optional `dimmed: boolean` prop adds a `dimmed` class
  on the root `.card`. CSS-only opacity change.
- Empty-filter result: when `filterActive && totalLiveCards > 0 &&
  matchingCardCount === 0`, render the F-16 `.empty-filter-result` strip
  *above* the `.board-area`, after the empty-board hint slot. Not a
  replacement for the board area — columns and Add-card composers stay
  reachable, satisfying the case where a user wants to fix the no-match by
  adding a card or clearing the filter.

```
┌─ .empty-filter-result ───────────────┐
│  No cards match your filter.        │
│  [Clear filter]                      │
└─────────────────────────────────────┘
```

Copy comes from F-16 §3.4.

## 6. Open/close behavior

- Open: click `.filter-btn` → toggle `open` state to true. Autofocus the
  text input on open (deferred via `useEffect` so layout is committed).
- Close triggers (any of):
  - `Esc` while popover is open.
  - Click outside `.filter-popover` AND outside `.filter-btn`. Use a
    `mousedown` document listener that ignores events whose target is inside
    either element (same pattern as `Column.tsx` kebab).
  - Another click on `.filter-btn` (toggle).
- No focus trap — the popover is a transient panel, not a dialog. Tab moves
  through controls naturally; Shift-Tab past the first or Tab past the last
  exits the popover but leaves it open (consistent with the existing kebab
  menu patterns).
- No save / cancel — every change is applied live (matches Trello).

## 7. Edge cases

- **Discussion mode** — Filter button is unmounted when `discussion ===
  true`. If the popover was open at the moment discussion starts, it closes
  on the next render (button gone → no anchor → no popover). The local
  filter state stays as-is for when discussion ends.
- **Read-only board** — Filter still works. All inputs render normally
  (filter is a view concern). The `Clear filter` link in the empty-result
  strip stays interactive.
- **Archived cards** — Not subject to filter. The archive panel renders its
  own list, untouched by F-15 state.
- **Archive panel open + filter active** — independent. The panel shows all
  archived cards; the filter only affects live columns underneath.
- **Card opens via `#card=<id>` while it's filtered out (dimmed)** — modal
  still opens. Filter does not block detail navigation.
- **Filter excludes every card while user is mid-DnD** — DnD cancels via
  the existing onDragCancel path because `hideNonMatching` removed the
  active draggable. Mitigation: filter is gated behind a click; the user
  isn't dragging at the same time. Acceptable.
- **Many labels** — popover label section scrolls vertically (`max-height
  140px; overflow-y: auto`) so the popover doesn't grow past the viewport.
  Same treatment for members if it ever gets long.
- **Filter active + zero live columns (F-16 §3.3 wins)** — no columns to
  filter, empty-zero-cols panel renders, empty-filter-result is suppressed.

## 8. CSS — new classes

All new on top of existing tokens — no new colors:

- `.filter-btn` — same metrics as `.anon-toggle` (28px pill, 11px font),
  `gap: 6px`, padding `0 10px`. Hover lifts color to `--fg2`.
- `.filter-btn[data-active="true"]` — text `--brand-violet-hi`, border
  `rgba(94,106,210,0.4)`, background `rgba(94,106,210,0.12)` (mirrors
  `.anon-toggle[data-on="true"]`).
- `.filter-btn-badge` — `font-family: var(--font-mono); font-size: 10px;
  background: var(--brand-indigo); color: #fff; border-radius: 9999px;
  padding: 0 5px; min-width: 16px; height: 14px;`. Inline-flex centered.
- `.filter-popover` — `position: absolute; top: calc(100% + 6px); right: 0;
  width: 280px; background: var(--bg-surface); border: 1px solid
  var(--border-2); border-radius: 8px; padding: 4px; z-index: 30;
  box-shadow: var(--shadow-dialog), rgba(0,0,0,0.4) 0 8px 24px;`
- `.filter-section` — `padding: 8px 10px; border-top: 1px solid
  var(--border-subtle);`. First section drops the top border.
- `.filter-section-label` — `font-size: 10px; font-weight: 510; color:
  var(--fg4); text-transform: uppercase; letter-spacing: 0.5px;
  margin-bottom: 6px;`
- `.filter-text-input` — `width: 100%; height: 28px; background:
  var(--bg-surface); border: 1px solid var(--border-2); border-radius: 6px;
  padding: 0 10px; font-size: 12px; color: var(--fg1); outline: none;`
  Focus: indigo border + 3px halo (matches `.col-title-input`).
- `.filter-list` — `display: flex; flex-direction: column; gap: 2px;
  max-height: 140px; overflow-y: auto;`
- `.filter-list-row` — `display: flex; align-items: center; gap: 8px;
  padding: 4px 6px; border-radius: 4px; font-size: 12px; color: var(--fg2);
  cursor: pointer;`. Hover: `--surface-02`.
- `.filter-list-row input[type="checkbox"]` — reuses `.label-checkbox`
  metrics (14×14 indigo accent).
- `.filter-list-row .swatch` — 12×4, radius 2 (mirrors `.label-stripe`,
  smaller for the popover).
- `.filter-due-options` — `display: grid; grid-template-columns: 1fr 1fr;
  gap: 4px 8px; font-size: 12px; color: var(--fg2);`
- `.filter-due-options label` — `display: flex; align-items: center; gap:
  6px; cursor: pointer;`
- `.filter-actions` — `display: flex; justify-content: flex-end;
  padding: 8px 10px; border-top: 1px solid var(--border-subtle);`
- `.card.dimmed` — `opacity: 0.3; transition: opacity 140ms;`. No
  `pointer-events: none` — the card stays clickable (per task spec).
- `.empty-filter-result` — `display: flex; align-items: center; gap: 12px;
  padding: 10px 18px; background: var(--surface-02); border-bottom: 1px
  solid var(--border-subtle); font-size: 12px; color: var(--fg2);`. The
  Clear-filter button reuses `.btn-subtle`.

## 9. Animations

- Popover open/close: instant in v1. F-21 polish pass can add a 120ms
  fade-and-translate later.
- Card dim transition: 140ms opacity fade. Reduced-motion: same — opacity
  transitions are tolerated by the spec.

## 10. Microcopy

- Filter button label: `Filter`.
- Text placeholder: `Search cards…`.
- Section headings: `Labels`, `Members`, `Due date`.
- Due-date options: `Any`, `Overdue`, `Due this week`, `Completed`.
- Toggle row: `Hide non-matching`.
- Clear button: `Clear all`.
- Empty filter result: `No cards match your filter.` + link `Clear filter`.

## 11. Open questions / punted

1. Saved filters — explicitly out of v1.
2. Cross-board search — out of v1.
3. Filter-by-checklist-progress — not requested. Skip.
4. Keyboard `/` shortcut — F-19 will wire it; F-15 just exposes a stable
   handler so the shortcut can call `openFilterPopover()`.
