# F-16 — Empty states (board, column, zero-column, filter)

## 1. Feature recap

A board can be empty in several ways: every column has zero cards (default seed for a fresh retro), a single column has zero cards, the board has zero columns at all (allowed per F-05 PO D4), or a filter (F-15) excludes everything. The user shouldn't stare at blank rectangles wondering whether the app loaded — calm, terse copy nudges them to act. Microcopy comes verbatim from HANDOVER §4.6 where it exists. Empty boards-list is owned by F-02 and not touched here.

## 2. Visual layout

```
[topbar ........................................]
[theme-bar (kanban: hidden, retro: open)]
[empty-board hint: "No cards yet. ..."  ← muted, single line]   ← only when ≥1 col and all cols empty
[board-area: columns each with their own emptyhint][add-col]
```

Zero-column variant replaces the board-area entirely:

```
[topbar][theme-bar]
[ centered: "This board has no columns yet. Add one to get started."
                       [+ Add column]                              ]
```

## 3. State specs

### 3.1 Empty board (≥1 column, every column has 0 cards)
- **Where**: a single-line `.empty-board-hint` rendered just above `.board-area`, after the theme bar.
- **Why not overlay**: an overlay covers the `Add a card` composer and per-column emptyhints; the user would have to dismiss the overlay before doing anything. A muted single-line nudge keeps the CTA path clear.
- **Copy** (HANDOVER §4.6): `No cards yet. Be the first — what's on your mind?`
- **Color**: `--fg3`. Italics off. Centered horizontally in board area gutter; 11–12px.
- **Discussion mode**: hidden (would just be noise).
- **Closed board**: still shown (read-only users seeing an empty board still benefit from the framing). No CTA.

### 3.2 Empty column (single col, cards.length === 0)
- **Where**: rendered inside the column body, **after** the `Add a card` button (so the composer remains the first visual call to action), inside `.col-cards`.
- **Class**: `.empty-column-hint`.
- **Copy** (HANDOVER §4.6): `Nothing here yet.`
- **Style**: `--fg4`, 11px, centered horizontally, ~16px vertical padding. Static.
- **Closed/discussion**: still shown; no behavior change.

### 3.3 Zero-column board (board.columns.length === 0)
- **Where**: replaces `.board-area` entirely.
- **Class**: `.empty-zero-cols` — flex column, centered, `--fg3` for headline copy + a primary CTA.
- **Copy**: `This board has no columns yet. Add one to get started.`
- **CTA**: `[+ Add column]` (`.btn .btn-primary`) — calls the same `onAddColumn` handler as the existing `.add-col` button. Hidden when `!isOwner` or `closed` or `discussion`. (Closed boards with zero columns just show the headline, no CTA — read-only users can't add.)

### 3.4 Empty filter result (STUB — F-15)
- **Where**: replaces `.board-area` content while a filter is active and yields zero matches.
- **Class**: `.empty-filter`.
- **Copy**: `No cards match your filter.` plus `Clear filter` link (`.btn-link` style — reuse `.crumb-link` muted text style).
- **F-15 dependency**: spec the copy + classes only. Dev leaves a `// TODO(F-15): wire empty filter state` comment in `RetroApp.tsx` near the board-area render. Do not wire any filter state in F-16.

## 4. Interaction

- No animations, no focus-shifting, no keyboard handling. Empty hints are passive text.
- Zero-column CTA: `Enter`/`Space`/click → invoke `onAddColumn` (same as `.add-col`).
- Reduce-motion: not relevant — no motion to suppress.

## 5. CSS classes / tokens

No new tokens. Reuse `--fg3` (board-level hint, zero-column headline) and `--fg4` (column-level "Nothing here yet.").

New classes in `globals.css`:
- `.empty-board-hint` — `padding: 8px 18px 0; font-size: 12px; color: var(--fg3); text-align: center;`
- `.empty-column-hint` — `padding: 14px 8px; font-size: 11px; color: var(--fg4); text-align: center;`
- `.empty-zero-cols` — `flex: 1; display: flex; flex-direction: column; gap: 12px; align-items: center; justify-content: center; padding: 40px 18px; color: var(--fg3); font-size: 13px;` Headline `<p>` reset margin.

## 6. Edge cases

- **Mixed**: board with one populated column and one empty column → 3.2 fires on the empty one only; 3.1 does not fire.
- **Discussion mode + 3.1**: hint hidden (per 3.1).
- **Read-only + 3.3**: headline shown, CTA hidden.
- **Filter ON + zero columns**: 3.3 wins (no columns to filter); 3.4 only fires when columns exist but none match.
