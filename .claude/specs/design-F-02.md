# F-02 — Boards list page (home)

## 1. Feature recap

The app's root URL `/` becomes the boards index. A user lands here, scans their boards grouped by status (Starred → Open → Closed → Archived), and clicks one to open it at `/boards/[id]` (the F-04 surface). A "Create board" CTA top-right opens the F-03 dialog. The current single-pane sidebar stays; what changes is the right pane and the sidebar's "Boards" / "Retros" link wiring. This replaces the placeholder home that, post-F-04, would otherwise still be the seed board.

## 2. Visual layout

Reuses the existing `.app` two-column shell (sidebar 232px + main). The main column is now a vertical stack of a topbar + a scrollable content area:

```
[sidebar][topbar: "Boards" h1 ............... [Create board]]
        [content: section · section · section · section]
                  └ Starred     ─ grid of cards
                  └ Open        ─ grid of cards
                  └ Closed      ─ grid of cards
                  └ Archived    ─ collapsed by default
```

**Grid, not list.** Recommendation: a Trello-style grid of cards. Justification: (a) board cards carry six visually distinct fields (title, type, count, time, star, state) that read better as a 2D tile than as a row of comma'd metadata, (b) the existing visual system (rounded surface tiles, 8–10px radii, low-contrast dark surfaces) is already tuned for grid-of-tiles compositions (`.col`, `.card`), so grid reuse is cheaper than designing a new row pattern, (c) Trello users expect it.

**Card size.** 240px wide × ~96px tall. Auto-fill grid: `repeat(auto-fill, minmax(232px, 1fr))` capped to a 4-column layout via `max-width` on the inner container so 5+ wide screens don't stretch cards into letterboxes.

**Spacing.** 12px gap between cards; 28px between sections; content area padding 22px 24px to match `.theme-bar` / `.board-area` rhythm.

**Breakpoints.** Desktop-first; the existing app is already single-pane and not responsive. Down to ~720px (single sidebar + main) the grid naturally collapses to 1–2 columns via `auto-fill`. Sub-720px is out of scope for v1 (matches the rest of the app).

## 3. Board card visual

```
┌────────────────────────────────────┐
│  ★  Sprint 24 — checkout v2    ⋯  │  ← title row: star, title, kebab
│  ───── theme color stripe ─────   │  ← 2px stripe in the swatch color
│  Retro · 12 cards                  │  ← meta row 1
│  updated 2h ago                    │  ← meta row 2 (or state pill if not open)
└────────────────────────────────────┘
```

- **Title** (prominent): 13px / 590 / `--fg1`, single line, `text-overflow: ellipsis`.
- **Star** (prominent): 14px star icon at top-left; filled `--brand-violet-hi` when starred, outline `--fg4` when not. Click toggles. Always visible (not hover-only) so users see the indicator without hovering.
- **Type badge**: lowercase pill in the meta row, classes `state-pill` + new `state-pill.kanban` / `state-pill.retro`. Retro uses indigo tint (matches existing accent), Kanban uses neutral surface. Keeps badges short and readable.
- **Card count** (secondary): `· 12 cards` inline after the type badge, `--fg3`, font-mono numerals to match other counts in the app.
- **Last-updated** (secondary): `--fg4`, 11px, on its own line under the type/count row. Format: see §7 microcopy.
- **Closed / Archived state pill** (prominent when present): replaces the "updated …" line — `closed · read-only` or `archived` in the existing `.state-pill` style. If both starred and closed/archived, the star still shows but the card is overall dimmed (opacity .65) so the eye treats it as deprioritized.
- **Theme color stripe**: 2px tall, 100% wide, just under the title. Uses the same color the sidebar swatch uses for that board (existing convention). Subtle — it's a recognition aid, not decoration.
- **Kebab** (`⋯`): hover-only, top-right, opens menu with: Star/Unstar, Open in new tab, Archive, (if archived) Unarchive, (if closed) Reopen. Most actions are wired by F-17/F-18 — for F-02 the kebab must exist; the disabled/coming-soon state of items waiting on F-17/F-18 is acceptable but flag in §9.

**Hover state.** Background `--surface-04` → `--surface-08`, border `--border-subtle` → `--border-standard`, transform `translateY(-1px)`, 140ms ease (matches `.card`). Kebab fades in (opacity 0 → 1) at 100ms.

**Focus state** (keyboard). Outline `1px solid var(--brand-indigo)`, offset 2px (matches `.crumb-link:focus-visible`).

**Active / pressed state.** Drop the lift, no transform.

## 4. Grouping / sections

Order, top to bottom: **Starred → Open → Closed → Archived**.

- **Section header.** Reuses `.side-head` typographic token (uppercase, 10px / 510, `--fg4`, 0.7px tracking) but at section scale: 11px, with an inline count chip (`Open · 7`). Padding 0 0 10px; sits flush-left with the grid below.
- **Collapse.** Each header is a button that toggles its grid. Caret icon (`chevron`, rotated) on the left of the label, 120ms rotate. Collapse is a height + opacity 180ms transition (matches HANDOVER §4.4 collapse rule).
- **Default collapsed state.** Archived = collapsed by default. All others expanded. Persist user's collapse choice in `localStorage` keyed by section name (cheap; the F-01 store already exists).
- **Empty Starred.** Recommendation: **hide the section entirely when zero**. Justification: starred is opt-in and discoverable from the per-card star icon; an empty "Starred" header just adds noise above what most users actually want (Open). Document the alternative ("show empty hint: 'Star a board to pin it here.'") for PO override — see §9.
- **Empty Open.** Don't hide — this is a legitimate edge case (user archived everything). Show inline muted line: *"Nothing open right now."*
- **Empty Closed / Archived.** Hide the section when zero. These are opt-in storage; no value in showing empty.

## 5. Empty state — no boards at all

Triggered when the store has zero boards across all groups (post-F-01 first launch with seed data prevents this for now, but the state must exist for users who delete the seed). Centered card in the content area, reusing `.modal` visual vocabulary (no overlay) the same way F-04's not-found panel does, wrapped in a reused `.board-empty` flex centerer:

- **Headline** (`h2`, 16px / 590, `--fg1`): `No boards yet.`
- **Body** (13px, `--fg2`, 1.5 line-height): `Create one to get started — kanban for ongoing work, retro for a team look-back.`
- **Primary CTA** (`.btn .btn-primary`): label `Create board`. Same handler as the topbar CTA (opens F-03 dialog).
- Width 360px, 22px padding. Matches §5 of the F-04 spec exactly so the two empty surfaces feel like the same family.

Voice: matches HANDOVER §4.6 — terse, no exclamation, conversational subordinate clause after the dash.

## 6. Topbar on home

There is no per-board topbar here (no title to inline-edit, no presence, no anon toggle, no theme). Replace it with a lighter row:

```
[Boards    ........................   [+ Create board] ]
```

- **Heading.** Plain `h1` `Boards`, 14px / 590 / `--fg1` / -0.15px tracking — same scale as `.board-title-input` so the topbar height (52px) stays consistent.
- **Right side.** A single `.btn .btn-primary` labeled `Create board` with leading `+` glyph (same plus character used in `.add-card-btn`). Tab order: heading → Create board.
- **No search input on home in v1.** Per backlog: per-board search is F-15, cross-board is OUT. A list-filter by board title is cheap (1 input over an array) but **leave it out for v1** — at <20 boards it's solving a non-problem, and adding it now creates an empty visual slot users will want to use as cross-board search (which doesn't exist). Flag for re-evaluation if board count grows. See §9.
- **No state pill, no presence, no anon, no Start discussion, no Close board** — none apply on the index.

## 7. Sidebar adjustments

The existing `Sidebar.tsx` keeps its workspace/Search/sections/user shell. Two wiring changes plus an active-state rule:

- **`Boards` item routes to `/`.** Today it's a static `<div>`; becomes a link. Its `count` continues to read total non-archived boards (already shown as `12`; F-01 makes it derived).
- **`Retros` sub-list is data-driven.** Currently four hardcoded swatch rows. Becomes `boards.filter(b => b.type === "retro" && !b.archivedAt)` mapped to `.side-item` rows. Each row's `swatch` color comes from the board's existing color field; `count` is the card total for that board. Linking goes to `/boards/[id]`.
- **Active-state rule.** Exactly one item highlighted at a time:
  - On `/` → the `Boards` item is `.active`. **No** retro row is active even if the user just came back from a retro.
  - On `/boards/[id]` where `type === "kanban"` → `Boards` item active. (No per-board entry in sidebar for kanban boards in v1; that would need a second sub-list and isn't requested.)
  - On `/boards/[id]` where `type === "retro"` → matching retro row active; `Boards` item is *not* active. (Only one highlight; the retro row is more specific.)
- **Workspace switcher.** Stays as-is (decorative; out of scope).

## 8. Microcopy bank

| Slot | Copy |
|---|---|
| Page heading | `Boards` |
| Top-right CTA | `Create board` |
| Section header — starred | `STARRED` |
| Section header — open | `OPEN` |
| Section header — closed | `CLOSED` |
| Section header — archived | `ARCHIVED` |
| Type badge — kanban | `kanban` |
| Type badge — retro | `retro` |
| State pill — closed | `closed · read-only` *(reuse from HANDOVER §4.6)* |
| State pill — archived | `archived` |
| Relative time — < 1 min | `just now` |
| Relative time — < 60 min | `Nm ago` (e.g. `12m ago`) |
| Relative time — < 24 h | `Nh ago` |
| Relative time — < 7 d | `Nd ago` |
| Relative time — < 30 d | `last week` / `2w ago` / `3w ago` |
| Relative time — older | `MMM d` (e.g. `Jan 12`); >1y → `MMM yyyy` |
| Empty Open section | `Nothing open right now.` |
| Empty boards entirely — headline | `No boards yet.` |
| Empty boards entirely — body | `Create one to get started — kanban for ongoing work, retro for a team look-back.` |
| Empty Starred (hidden default; override copy) | `Star a board to pin it here.` |
| Card kebab — star | `Star` / `Unstar` |
| Card kebab — open new tab | `Open in new tab` |

Voice notes: section headers in uppercase to match `.side-head`; type badges and state pills lowercase to match HANDOVER §4.6 convention; relative time uses the short numeric form because the meta line is already secondary and shouldn't shout.

## 9. CSS tokens used / introduced

Reused: `.app`, `.sidebar`, `.main`, `.topbar`, `.btn .btn-primary`, `.side-head`, `.side-item`, `.state-pill`, `.modal`, `.board-empty`, `.avatar`, `--fg1/2/3/4`, `--surface-02/04/05/08`, `--border-subtle`, `--border-standard`, `--brand-indigo`, `--brand-violet-hi`.

New, all justified:

- **`.boards-page`** — wrapper for the home content area; vertical stack with 28px gap. Justified: `.board-area` is horizontal/flex with overflow-x; the index needs vertical scroll.
- **`.boards-page-head`** — replaces the per-board `.crumbs` row inside `.topbar`. Heading + spacer + CTA. Could be inlined as `.topbar` children but a named class keeps the topbar component branchable on route.
- **`.board-section`** — section wrapper; padding & section gap.
- **`.section-title`** — section header (button). Inherits `.side-head` styling at section scale, plus a count chip. New because `.side-head` is sized for the sidebar (10px). One rule: `font-size: 11px; padding: 0 0 10px; display:flex; align-items:center; gap:8px;`.
- **`.board-grid`** — `display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); gap: 12px; max-width: 1080px;`.
- **`.board-card`** — surface tile. Reuses `--surface-02` / `--border-subtle` like `.card` but with index-card padding (12px 14px 11px), 10px radius (matches `.col`, not `.card`'s 8px — it's a board-scale tile, not a card-scale one). 96px min-height.
- **`.board-card-title`** — 13px / 590 / `--fg1`, single-line ellipsis.
- **`.board-card-meta`** — 11px row containing type badge + `· N cards`. `--fg3` text, font-mono numerals.
- **`.board-card-time`** — 11px / `--fg4` updated-time line. Hidden when state pill is present.
- **`.board-card-star`** — 14px star button, top-left of the card.
- **`.board-card-stripe`** — 2px theme-color stripe element under the title.
- **`.state-pill.kanban`** — neutral; inherits `.state-pill` defaults. (Could skip if we treat plain `.state-pill` as kanban; recommend keeping the modifier explicit for legibility in markup.)
- **`.state-pill.retro`** — indigo tint: `color: var(--brand-violet-hi); border-color: rgba(94,106,210,0.25); background: rgba(94,106,210,0.08);`. Mirrors `.state-pill.open`'s pattern with the indigo accent instead of green.
- **`.state-pill.archived`** — `--fg4`. Mirrors `.state-pill.closed`.

No new CSS custom properties. No new colors.

## 10. PO decisions

> Resolved 2026-04-29 by Product Owner. All six decisions below are final for F-02. No escalations.

1. **Empty Starred section behavior — CONFIRMED: hide when zero.** Star is opt-in and the per-card star icon is the discovery surface. An empty section header above "Open" is pure noise for the 90% case (new users with nothing starred yet). The hint copy stays in the microcopy bank for potential future use but is not shipped in F-02.

2. **List-filter input on home — CONFIRMED: leave out of v1.** Designer's reasoning is correct: at <20 boards (an explicit backlog assumption) it solves nothing, and an empty input slot will be read as cross-board search — which is on the OUT list. Revisit if a user reports >20 boards in practice.

3. **Kebab menu on board cards — CONFIRMED partial scope: ship only `Star` / `Unstar` and `Open in new tab` in F-02.** Archive / Reopen / Unarchive are owned by F-17 (board settings menu) and F-18 (star/favorite); they land with their owning features and are *not* present-but-disabled in F-02. Avoiding stub-disabled menu items prevents the "why is this greyed out" support question. Note: F-18 is the canonical owner of starring on a board card; F-02 wires the per-card star action against the F-01 store directly so it works pre-F-18.

4. **Active sidebar item for kanban boards — CONFIRMED: highlight top-level `Boards`.** A separate "Kanban boards" sub-list is OUT for v1 (sidebar real estate is finite; kanban boards are accessed via the home page). One highlight rule is simpler and matches the spec.

5. **Board theme color source — CONFIRMED: color is a stable field on `Board`, seeded at creation, not derived, not user-editable in v1.** This is an F-01 acceptance criterion (see backlog AC update below). F-03 picks a color at create time (round-robin or hash-of-id from a fixed palette — designer's call within F-03). Custom color picker is OUT for v1.

6. **Last-updated definition — CONFIRMED: bump `updatedAt` on any mutation in the board's tree.** Specifically: card add/edit/delete/archive/move, column add/rename/delete/reorder, board title/theme edit, label CRUD on the board. Vote toggles in retro mode also bump `updatedAt` (a vote is a meaningful change to the board's state from the user's perspective). This is an F-01 acceptance criterion (see backlog AC update below).

### Backlog AC changes triggered by these decisions

- **F-01** gains an explicit AC: `Board includes a stable seeded color field used by the sidebar swatch and boards-list theme stripe; not user-editable in v1.`
- **F-01** gains an explicit AC: `updatedAt is bumped on any mutation within the board's tree (card CRUD/move/archive, column CRUD/reorder, board title/theme edit, label CRUD, retro vote toggle).`
- **F-02** gains an explicit AC: `Card kebab menu in F-02 contains only Star/Unstar and "Open in new tab"; Archive/Reopen/Unarchive ship with F-17/F-18.`
