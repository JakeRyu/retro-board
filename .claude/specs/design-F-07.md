# F-07 — Card details modal (shell only)

## 1. Feature recap

Clicking a card body opens a richer surface where, over the next several specs (F-08 description, F-09 checklist, F-10 due date, F-11 labels, F-12 members, F-13 comments, F-14 archive), users can flesh a card out into a real unit of work. F-07 is the **shell**: the chrome, layout, open/close behavior, header, and empty sidebar/main slots that sub-features will fill in. The sub-feature specs decide what goes inside each slot; this spec only guarantees the slots exist and behave consistently. Visually the modal extends the existing `.modal` family from the close-board confirm in `RetroApp.tsx` — same surface tokens, same overlay, same shadow — but bigger and two-column.

## 2. Trigger — disambiguating click vs drag

The board has dnd-kit wired with a `PointerSensor` `activationConstraint: { distance: 6 }` (see `RetroApp.tsx` sensors). That gives us a free click/drag disambiguator: until the pointer moves 6px, dnd-kit hasn't started a drag, so a synthetic `click` will fire on `mouseup` as normal.

**Open trigger:** click on the `.card` body itself, **not** on:

- `.kebab-trigger` and the open kebab menu (already `e.stopPropagation()` on `pointerdown`)
- `.vote-btn` (already `e.stopPropagation()` on `pointerdown`)
- the inline-edit `<textarea class="card-edit-input">` (only present while inline-editing)

Implementation note for the developer:
- Add an `onClick` to the card root. Inside, bail if `e.defaultPrevented` (drag took over) or if the original `target` is inside one of the suppressed sub-elements — quickest is `target.closest('.kebab-trigger, .kebab-menu, .vote-btn, .card-edit-input')`.
- Do **not** add `pointerdown` to open. Pointerdown on the card root is consumed by dnd-kit's listeners. Click is the right hook because dnd-kit's 6px activation constraint will swallow the click if a real drag started.
- In **discussion mode** and **read-only (closed)** state, opening still works — discussion mode just disables DnD and voting, not viewing. In read-only the modal renders with all controls disabled (§7).
- Cards that are currently in inline-edit (`.card-edit-input` mounted) do **not** open the modal even if the user clicks within the card frame — body is replaced by the textarea, so clicking the textarea targets it directly. No extra guard needed.

Hover affordance: `cursor: pointer` is already set via the existing `.card { cursor: grab }` rule, which feels right for a draggable item. Don't change cursor on the body — drag is the dominant gesture; click-to-open is a free secondary.

## 3. Modal layout

Big two-column modal, sized for content:

```
┌─ .modal-overlay ────────────────────────────────────────┐
│   ┌─ .modal.modal-card-details ──────────────────────┐  │
│   │  ┌─ header ─────────────────────────────────[×]┐ │  │
│   │  │  [title input ─────────────────────]          │ │  │
│   │  │  [▲ N voters…]    (retro mode only)           │ │  │
│   │  └────────────────────────────────────────────┘ │  │
│   │  ┌─ .cd-grid ──────────────────────────────────┐ │  │
│   │  │ ┌─ .cd-main ─────────┐ ┌─ .cd-side ───────┐ │ │  │
│   │  │ │ .cd-description    │ │ .cd-side-due     │ │ │  │
│   │  │ │ .cd-checklist      │ │ .cd-side-labels  │ │ │  │
│   │  │ │ .cd-comments       │ │ .cd-side-members │ │ │  │
│   │  │ │                    │ │ .cd-side-archive │ │ │  │
│   │  │ └────────────────────┘ └──────────────────┘ │ │  │
│   │  └─────────────────────────────────────────────┘ │  │
│   └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

- **Width:** `720px`, `max-width: 92vw` (matches existing modal pattern).
- **Height:** `min(80vh, content)`. The modal itself does not scroll; the **`.cd-grid`** inner area scrolls vertically (`overflow-y: auto`) so the header and close button stay pinned.
- **Padding:** 22px horizontal/top, 18px bottom (slightly less than 22px so a long comments list doesn't visually crowd the bottom edge after the scroll fade).
- **Grid template:** `grid-template-columns: 1fr 220px; gap: 24px` on `.cd-grid`. Sidebar is fixed 220px so future avatar/label rows have a predictable target width.
- **Mobile / narrow viewport:** at `max-width: 640px`, collapse to a single column — `.cd-grid { grid-template-columns: 1fr; }` and `.cd-side` moves below `.cd-main`. Sidebar slot order stays the same. No other layout change.
- **Section headings inside slots:** each slot owns its own `<h3>` heading at the top, `11px / 510 / --fg4 / uppercase / 0.7px tracking` (matches `.field-label` from F-03). F-08–F-14 use these to label themselves; F-07 only spec's the slot wrapper, not the header text.

## 4. Header

Single header row, padded to align with the body grid:

- **Title** — inline-edit input. Reuses the `.board-title-input` pattern from the topbar (transparent border, hover/focus tint to `--surface-04`, `--brand-indigo` border on focus). Larger than the topbar version: `font-size: 18px; font-weight: 590; letter-spacing: -0.2px;`. Full width minus the close button. Enter/blur saves; Esc reverts. Validation: trim, ≥ 1 char (empty title rejected, revert to last value silently). Same ≤ 80 char rule as board title.
- **Retro vote row** — only when `board.type === "retro"` and `!closed`. Below the title, a single row containing `<Voters>` (avatar pile, same component as on the card preview) and `<VoteButton>` (same component, same `data-voted` styling). Reuses the existing `.vote-row` flex pattern but pinned left, not right.
- **Close button** — top-right corner of the modal, absolutely positioned (top: 14px, right: 14px). Reuses `.btn-icon` styling, an `Icon name="close"`. `aria-label="Close card"`. Tab order: last in the modal (so Tab from the title moves through content first).

When read-only (closed board), the title input is `disabled` (matches `.board-title-input` in topbar) and the vote row is **hidden** entirely (matches the `!readOnly` guard already used in `Card.tsx`).

## 5. Open / close behavior

### Opening

- Click on a card (per §2) sets local state `openCardId` and **replaces** the URL hash with `#card=<id>` via `history.replaceState(null, '', '#card=' + id)`. No new history entry — refreshing should restore, but back-button should not collect a stack of card opens.
- On `RetroApp` mount: read `window.location.hash`, parse `#card=<id>`. If the id matches a card on the **current** board, open the modal. If it matches no card on this board (stale link, archived, deleted), silently strip the hash and do nothing. If the id matches a card on a *different* board — out of scope for F-07; F-07 lives inside `RetroApp` and only sees the current board. Cross-board deep links are a v2 concern (no router-level dispatch yet).
- Listen for `hashchange` while mounted so back/forward navigation updates the open card. (User uses browser back, hash empties, modal closes.)

### Closing

Three paths, all converge:

1. **Esc** — single `keydown` handler on `window` while open; close on `Escape`. Discussion-mode keys (←/→/Esc, see `RetroApp.tsx`) are gated behind `discussion && !openCardId` so the modal swallows Esc first. (Update the existing `useEffect` to add `&& !openCardId` to its trigger condition.)
2. **Close button** — direct handler.
3. **Overlay click** — handled with the pointerdown-vs-click distinction described below.

On any close: clear `openCardId`, then `history.replaceState(null, '', window.location.pathname + window.location.search)` to strip the hash. No focus-restore in v1 unless trivial — the originating card may have moved or been deleted while open. (If trivial: store the originating element and `el.focus()` if it's still in DOM. Flag for PO if unclear.)

### Overlay click — pointerdown distinction

The naive `onClick` on the overlay closes when the user starts a text-selection drag inside the modal and releases outside. To avoid this:

- On `pointerdown` on the overlay (target check: `e.target === e.currentTarget`), set a ref `pointerStartedOnOverlay = true`.
- On any `pointerdown` on the modal body, set `pointerStartedOnOverlay = false`.
- On overlay `click`, only close if `pointerStartedOnOverlay === true`. Reset after.

This pattern mirrors how textarea selection-drag should be safe across the close-board confirm modal too (existing modal uses naive `onClick` and is exposed to the same bug, but its body has no draggable text — flag in §10, do not fix in F-07).

## 6. Empty section placeholders

Each slot is a `<section>` with the class names listed below. F-07 ships them as **empty** wrappers (no children) plus an HTML comment `{/* F-XX slot — owned by spec design-F-XX.md */}` so future devs land in the right place. Slots:

| Slot wrapper | Owner spec | Notes |
|---|---|---|
| `.cd-description` | F-08 | First in `.cd-main`. |
| `.cd-checklist` | F-09 | Second in `.cd-main`. |
| `.cd-comments` | F-13 | Last in `.cd-main`. Composer-then-list per F-13. |
| `.cd-side-due` | F-10 | First in `.cd-side`. |
| `.cd-side-labels` | F-11 | Second in `.cd-side`. |
| `.cd-side-members` | F-12 | Third in `.cd-side`. |
| `.cd-side-archive` | F-14 | Last in `.cd-side`. Visually separated by a 1px `--border-subtle` divider above. |

Each slot wrapper gets a vertical bottom margin of `18px` (main) / `14px` (sidebar) so future content has a known starting gap. F-07's CSS scopes this on the wrapper, not the children — sub-feature specs don't need to fight margins.

## 7. Read-only state

When `board.state === "closed"`:

- Modal opens normally.
- Title input is `disabled` (input is still rendered for content visibility — same pattern as topbar `.board-title-input`).
- Vote row is hidden (matches `!readOnly` in `Card.tsx`).
- All future sub-feature controls render disabled/read-only per their own specs. F-07 only spec's its own header.
- Close behavior unchanged.

`data-readonly="true"` is already on the `.app` root (see `RetroApp.tsx` line 477) — sub-feature CSS can hook off it inside the modal too. For the title specifically, `.modal-card-details .board-title-input:disabled` plus the existing disabled treatment is enough.

## 8. Animations

- **Open.** Inherit `.modal-overlay`'s 150ms opacity transition. Override the modal slide to **180ms** and a slightly larger displacement (`translateY(-8px → 0)` to emphasize the larger surface). Easing matches existing `ease`.
- **Close.** 140ms opacity-out (overlay) + 140ms slide-out. Slightly faster than open — closing should feel snappy. Implementation: toggle `.open` on the overlay; the existing `transition: opacity 150ms` applies to opening; close is achieved by removing `.open`. To get 140ms closing specifically, add `transition: opacity 150ms` for `.open` state and `transition: opacity 140ms` for the unset state via a `.modal-overlay.closing` modifier briefly. **Simpler v1:** keep both at 150ms (matches close-board confirm exactly). Flag the asymmetric timing as a polish nice-to-have if PO doesn't care.
- **Reduced motion.** Inherits — `prefers-reduced-motion` will collapse all transitions once F-21 lands.

## 9. CSS tokens used / introduced

Reused: `.modal-overlay`, `.modal`, `.btn-icon`, `.board-title-input`, `.vote-row`, `.voters`, `.vote-btn`, `--bg-surface`, `--border-subtle`, `--border-standard`, `--shadow-dialog`, `--fg1/2/3/4`, `--surface-02/04`, `--brand-indigo`.

New, all justified:

- **`.modal.modal-card-details`** — width 720px, max-width 92vw, max-height 80vh, padding 22px 22px 18px, position relative (for the close button). Justified: existing `.modal` is 420px and centered-content; this one is wider and structured.
- **`.cd-header`** — flex column, gap 8px, padding-right 36px (room for the absolute close button), border-bottom 1px `--border-subtle`, padding-bottom 14px, margin-bottom 14px.
- **`.cd-close`** — absolute top: 14px, right: 14px. (Matches `.btn-icon` size; this is just a positioning helper.)
- **`.cd-grid`** — display grid, `grid-template-columns: 1fr 220px`, gap 24px, overflow-y auto, max-height calc to fill the modal minus header. `@media (max-width: 640px) { grid-template-columns: 1fr; }`.
- **`.cd-main`** — flex column, min-width 0 (so children can clip rather than push the grid wider).
- **`.cd-side`** — flex column, gap 0 (each `.cd-side-*` slot owns its own bottom margin).
- **`.cd-description`, `.cd-checklist`, `.cd-comments`** — main-column slots; bottom margin 18px (drop on `:last-child`).
- **`.cd-side-due`, `.cd-side-labels`, `.cd-side-members`, `.cd-side-archive`** — sidebar slots; bottom margin 14px (drop on `:last-child`). `.cd-side-archive` gets `border-top: 1px solid var(--border-subtle); padding-top: 14px;` to visually demote the destructive action.

No new CSS custom properties. No new colors. Sub-feature specs will introduce their own slot-internal classes; they should not redeclare the wrapper classes above.

## 10. PO decisions

1. **Modal timing: 150/150 symmetric.** Family-consistent with close-board confirm. Asymmetry is gold-plating; reject. Update §8 to drop the 180/140 path — both open and close are 150ms.

2. **Focus restore: yes, best-effort.** On close, if the originating card element is still in the DOM, call `.focus()` on it. If it's gone (DnD'd, deleted, archived), no-op silently — do not chase it. Keyboard a11y win is worth the small ref.

3. **Cross-board `#card=<id>` deep link: silent no-op confirmed.** F-07 lives inside `RetroApp` and only sees the current board. Cross-board routing is a v2 concern — not a v1 bug. No AC change needed.

4. **Pointerdown leak in close-board confirm: track as polish, not in F-07.** Folded into F-21 (realtime/polish pass). Do not fix here. No AC change needed.
