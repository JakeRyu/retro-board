# F-15-RM — Remove search and filter

## Goal

Strip the Filter button and its popover from the retro board topbar. With
labels, members, and due dates gone, the filter has no meaningful dimensions.
Retros have at most 50 cards; scanning is cheap. The topbar gets quieter.

---

## Removed surfaces

- `app/_components/FilterPopover.tsx` — delete the file entirely.
- `app/_lib/cardMatchesFilter.ts` — delete the file entirely.
- `app/_components/RetroApp.tsx` — remove:
  - `import { FilterPopover }` and `import { EMPTY_FILTER, cardMatchesFilter, isFilterActive, type BoardFilter }` lines
  - `filter` and `filterOpen` state declarations
  - `filterActive`, `cardMatches`, `liveCardCount`, `matchingCardCount`, `showEmptyFilterResult` derived values
  - The two `useEffect` blocks keyed on `board.id` and `discussion` that reset / close the filter
  - The `{!discussion && (<FilterPopover …/>)}` JSX block in the topbar action cluster
  - The `showEmptyFilterResult` conditional block that renders `.empty-filter-result`
  - `cardMatches` and `hideNonMatching` props passed down to `<Column>`
- `app/_components/Column.tsx` — remove `cardMatches` and `hideNonMatching` props and any
  branching logic that dims or hides cards based on those props.
- `app/_components/Card.tsx` — remove the `dimmed` prop and the `.card.dimmed` class application.
- `app/_components/ShortcutsCheatSheet.tsx` — remove the `{ keys: ["/"], description: "Open filter" }` row from the `"On a board"` group.
- `app/globals.css` — remove `.filter-btn`, `.filter-btn-badge`, `.filter-popover`,
  `.filter-section`, `.filter-section-label`, `.filter-text-input`, `.filter-list`,
  `.filter-list-row`, `.filter-due-options`, `.filter-actions`, `.card.dimmed`,
  `.empty-filter-result` class definitions.

---

## Topbar layout after removal

The right-side action cluster currently reads (outside discussion mode):

```
[presence] [Filter] [Anonymous] [Start discussion] [Close board] [Settings]
```

After removal it reads:

```
[presence] [Anonymous] [Start discussion] [Close board] [Settings]
```

The gap left by the Filter button is absorbed by the existing `gap: 10` flex
container. No spacer, no placeholder, no visual fill. The cluster simply steps
closer by one button-width. The Anonymous toggle becomes the leftmost control
in the cluster, which is fine — it was already visually adjacent to Filter and
shares the same pill metric. No other button changes position, label, or state.

---

## Cheat-sheet adjustment

In `ShortcutsCheatSheet.tsx` the `GROUPS` constant has an `"On a board"` group
with two rows: `c` (Add a card) and `/` (Open filter). Remove the `/` row.
The `"On a board"` group is left with one row (`c`). This is acceptable — a
single-row group is not visually awkward given the existing layout (each group
is a flex column with a heading; one row renders cleanly). The section heading
`"On a board"` stays because `c` is still a board-scoped shortcut worth
documenting. No section header is orphaned.

---

## Empty-state cleanup

The `.empty-filter-result` strip (copy: "No cards match your filter." + "Clear
filter" link) is rendered in `RetroApp.tsx` under the `showEmptyFilterResult`
guard. Remove the entire conditional block. The `.empty-filter-result` CSS
class is also removed from `globals.css`. No replacement empty state is needed:
filter-active-with-zero-matches is no longer a possible product state.

The F-16 spec section §3.4 was already marked as a stub tied to F-15. That
stub is now fully resolved by deletion — no lingering `// TODO(F-15)` comments
should remain after this cleanup.

---

## Keyboard shortcut removal

In `RetroApp.tsx` the board-scoped `keydown` effect (lines ~431–459 in current
source) handles both `c` and `/`. Remove only the `/` branch:

```
if (e.key === "/") {
  if (discussion) return;
  e.preventDefault();
  setFilterOpen(true);
}
```

The `c` branch and the outer suppression logic (`ctrlKey` guard, editable-
target guard, `isShortcutsCheatSheetOpen` guard, `openCardId` guard) all
remain — they serve the surviving `c` shortcut.

`GlobalShortcuts.tsx` does not handle `/` directly; no change needed there.

---

## Microcopy / aria sweep

Grep and remove every occurrence of the following strings (case-insensitive
where noted):

- `"Filter"` — button label in `FilterPopover.tsx` (gone with the file), any
  `aria-label` containing "Filter" on the trigger button.
- `"Search cards"` — placeholder text in `.filter-text-input`.
- `"No cards match your filter"` — `.empty-filter-result` copy.
- `"Clear filter"` — link label in the empty-filter strip.
- `"Clear all"` — popover footer button label (gone with the file, but check
  for any stray test-id or aria reference).
- `"Open filter"` — cheat-sheet row description.
- `filterOpen` / `filter` / `filterActive` — state/variable names; ensure no
  dead references remain after the import deletions.
- `data-testid` attributes containing `filter` — scan `FilterPopover.tsx` and
  any test files; remove with the file or update snapshots.
- `aria-expanded` and `aria-haspopup="dialog"` on the filter trigger button —
  gone with the component, but confirm no JSX fragment copies them elsewhere.
- Comment `// F-15` — any inline code comment citing F-15 should be removed
  or updated to avoid confusing the future reader.

---

## Card rendering after removal

Cards always render at full opacity. The `dimmed` prop is removed from the
`Card` component interface. The `.card.dimmed { opacity: 0.3 }` CSS rule is
removed from `globals.css`. No conditional class, no prop default, no fallback.
Every card in every column is always fully visible.

`Column.tsx` no longer receives `cardMatches` or `hideNonMatching` props. Any
branching that filtered the card list for DnD (`SortableContext`) or that
passed a `dimmed` flag down to `<Card>` is deleted. The column renders its full
`col.cards` array unconditionally (subject only to the existing discussion-mode
sort-by-votes path, which is unrelated).

---

## Out of scope

- Any replacement search or filter mechanism — explicitly cut, per backlog.
- Data-layer migration for filter state — filter was never persisted; nothing
  to migrate.
- Column props shared with other features (`readOnly`, `sortByVotes`, etc.) —
  not touched.
- `cardMatchesFilter.ts` utility reuse elsewhere — grep confirms it is only
  imported in `RetroApp.tsx` and `FilterPopover.tsx`; both are removed.
