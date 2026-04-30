# F-18 — Star / favorite a board

## 1. Feature recap

A user with many boards needs the ones they touch every day to surface above the rest. F-18 adds a single star toggle reachable from three places — the boards-list card (already shipped with F-02), the per-board topbar, and the sidebar Retros list — and uses the star state to drive ordering: `Starred` group on the home page, starred-first on the sidebar Retros list. Per-card behaviour and styling already exist from F-02; this spec covers the topbar affordance and the recency ordering inside the Starred group.

## 2. Visual layout

Topbar, retro/kanban board view (`RetroApp.tsx`):

```
[Boards/Retros / Title-input  [● open]  ★   ............  [presence][filter][anon][Start discussion][Close board][⋯]]
```

The star sits **inside `.crumbs`**, immediately right of the state pill, **left of the right-side action cluster** (presence, filter, anon, Start discussion, Close board, settings kebab). Click toggles. Same hover/focus treatment as the board-card star. Visible on closed and archived boards too — starring is a personal-priority signal, not a state mutation.

## 3. States

- **Default (unstarred)**: outline star, `--fg4`. Tooltip `Star this board`.
- **Starred**: filled star, `--brand-violet-hi`. Tooltip `Unstar this board`. `aria-pressed=true`.
- **Hover**: bg `--surface-04`, color `--fg2` (unstarred) / unchanged violet (starred). 120ms ease — matches the card star.
- **Focus-visible**: 1px `--brand-indigo` outline, 1px offset. Matches `.crumb-link:focus-visible`.
- **Active/pressed**: no transform; immediate state flip.
- **Discussion mode**: button stays mounted and reachable; nothing in F-18 hides it. Discussion owns the right cluster but the breadcrumb row keeps the title + state + star.
- **Disabled**: never. Even read-only/archived boards can be starred.

## 4. Interaction spec

- **Click target**: 18×18 button, identical hit-box to `.board-card-star`.
- **Microcopy**: `aria-label = board.starred ? "Unstar board" : "Star board"`. `title` attribute mirrors aria-label so mouse users get a tooltip.
- **Keyboard**: focusable button, `Enter` / `Space` toggle. Tab order: title input → state pill (non-focusable) → star → presence (non-focusable) → filter → anon → Start discussion → Close board → settings.
- **No confirm**, no toast — toggle is reversible and trivial. Matches the card star.

## 5. Animations

- Color/background transition 120ms ease (reused from `.board-card-star`).
- No fill morph or "burst" animation; calm visual language.

## 6. Sidebar Retros sub-list

Already implemented in F-02 (`Sidebar.tsx` lines 23–31): retros are sorted with a stable comparator that puts `starred=true` ahead of `starred=false`, otherwise preserves input order. F-18 verifies this and adds nothing further. No visual change to the row itself — the star isn't drawn on sidebar rows; the swatch already carries identity, and adding a second leading glyph would break the row rhythm.

## 7. Boards list "Starred" group ordering

Backlog AC: *"Starred boards appear in their own 'Starred' group on the list, ordered by most-recently-starred."*

To support recency, `Board` gains an optional `starredAt?: string` (ISO timestamp). The `Starred` group on `BoardsPage.tsx` sorts by `starredAt` descending, falling back to `updatedAt` for any board where `starredAt` is missing.

- `storeActions.toggleStar` sets `starredAt = new Date().toISOString()` on star, clears it on unstar.
- `migrateBoard` backfills boards that have `starred=true` but no `starredAt` with `starredAt = updatedAt`. Deterministic seed-based timestamp avoids the "everything starred at once" bug where existing starred boards would all bunch at the top in arbitrary order on first load after the F-18 deploy.

## 8. Edge cases

- **Star + closed/archived**: card on home page is already `dimmed` (opacity 0.65). The `Starred` group still hosts these dimmed cards, since starring is independent of board state. Document that starring an archived board does NOT pull it out of the Archived group on the home page — `archivedAt` partitioning still wins (matches existing F-02 partition logic).
- **Many starred boards**: same grid as Open, no special truncation. If a user has >20 starred boards they're using the feature differently than designed; revisit.
- **Concurrent toggle in another tab**: `useStore` re-renders on store hydration. Not a concern for v1 (no realtime sync).

## 9. CSS tokens used / introduced

Reused: `.board-card-star` styles (color/hover/focus pattern), `--fg4`, `--fg2`, `--brand-violet-hi`, `--brand-indigo`, `--surface-04`.

New:
- **`.topbar-star`** — inline star button inside `.crumbs`. Same visual treatment as `.board-card-star` but `position: static` (no absolute positioning), 18×18, 3px radius, color transitions 120ms. `.topbar-star.on` flips color to `--brand-violet-hi`. Justification: the card star is `position:absolute` to anchor in the corner of a tile; the topbar version flows inline next to the state pill, so it can't share the class wholesale.

No new CSS custom properties.

## 10. Open questions

None for v1. PO already locked acceptance criteria in the backlog.
