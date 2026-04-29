# F-11 — Card labels

## 1. Feature recap

Boards carry a small set of colored, optionally-named labels. Users tag cards with them to categorize at a glance and (in F-15) filter by them. F-11 ships:

- A label set on every board (default 6, drawn from `BOARD_COLORS[0..5]`, no names).
- A `LabelPicker` in the card details modal's `.cd-side-labels` slot that toggles labels on/off for the card and doubles as a lightweight management UI (rename / add / delete).
- A `LabelStripes` row above the card preview body that shows up to 5 stripes, with a "+N" overflow indicator.

Visual identity: stripes are flat color, no gradients; pills reuse the existing `--surface-*` / `--fg*` token family. Label color palette is the existing `BOARD_COLORS` (7 swatches) — no new hex.

## 2. Card preview — `.label-stripes`

Renders **above** `.card-body` inside `.card`, before any content. Hidden when the card has zero labels.

```
┌─ .card ────────────────────┐
│  ░░░░ ░░░░ ░░░░ ░░░░ ░░░░ +3│  ← .label-stripes
│  Card body text…           │
│  …                         │
│  [author]      [▲ votes]   │
└────────────────────────────┘
```

- One pill per label: 28px wide, 4px tall, `border-radius: 2px`, `background: <label.color>`.
- Gap 4px, max 5 visible. If the card has > 5, render the first 5 and append `<span class="label-stripes-more">+N</span>` (10px mono, `--fg4`).
- Stripes are `display: inline-flex; gap: 4px; margin-bottom: 8px;` so they push the body down without colliding with the existing `.card` padding.
- **Hover tooltip:** native `title` attribute on each stripe, content = `label.name || "Unnamed (<color name>)"`. Cheap, accessible, no extra DOM.
- Stale label ids (label was deleted but card still references it) are silently dropped at render time — no zombie pills.

## 3. Modal sidebar — `.cd-side-labels`

Replaces the F-07 placeholder. Heading stays "Labels" (`.cd-section-label`).

```
┌─ .label-picker ─────────────────┐
│ [☑]  ▮  Frontend                │  ← .label-row (named, checked)
│ [ ]  ▮  Backend           [×]  │  ← hover shows × delete button
│ [☑]  ▮  [Add a name…       ]    │  ← unnamed → inline input
│ [ ]  ▮  Untitled                │  ← unnamed, not yet edited
│ ─────────────────────────────── │
│  [+ Create a new label]         │  ← .label-create
└─────────────────────────────────┘
```

### Row anatomy (`.label-row`)
- Checkbox: 14×14 square, indigo when checked. Reuses no existing checkbox class — introduce `.label-checkbox` (matches `.col-kebab` simplicity).
- Color swatch: 16×16 rounded 3px, background = label color. `.label-swatch`.
- Name area: `.label-name`. Click-to-edit:
  - Named, idle: text. Click → swap to `<input>` pre-filled with the name. Enter / blur saves; Esc reverts. ≤ 30 chars.
  - Unnamed: shows muted "Untitled" placeholder (`--fg4`, italic). Click → input opens empty.
  - Owner-only. Read-only board: no swap, no input.
- Actions (`.label-actions`): tiny × delete button on row hover (owner only). On click → swap that row to inline confirm: `Delete this label?  [Yes] [Cancel]` (text in `.label-row.confirming` modifier). No modal, no toast — cheaper inline confirm per task spec. Yes deletes, Cancel reverts. The label id is also stripped from any card.labels arrays in the same store action.

### Create row (`.label-create`)
- Default: button `+ Create a new label`, full-width, ghost style (matches `.add-card-btn` pattern: dashed border, `--fg3` color).
- Click → row expands inline showing: `[name input]` + 7-color swatch picker (one swatch per `BOARD_COLORS` entry, 18×18 rounded 4px, current pick has 1px `--brand-indigo` outline) + `[Create] [Cancel]` buttons. Default selected color = `BOARD_COLORS[0]`.
- Enter on name input = Create. Esc = Cancel. Empty name is allowed (creates unnamed). New label is appended to `board.labels` and the new row appears above the create button.

### Empty state
When `board.labels.length === 0`:
```
No labels yet. Create one.
[+ Create a new label]
```
Muted text (`--fg4`, italic, 12px), then the same create button. Once any label exists the empty copy disappears.

### Read-only board
- Picker still renders so the user can see what's tagged.
- All checkboxes `disabled`; rows lose hover affordance.
- No × delete button, no name swap, no create button.

## 4. Interaction spec

| Action | Trigger | Result | Microcopy |
|---|---|---|---|
| Toggle label on card | Click row checkbox / row body (excluding name/×) | Calls `toggleCardLabel` | — |
| Edit name | Click name (owner) | Input appears, name selected | Placeholder: "Add a name…" |
| Save name | Enter / blur | Persists trimmed value | — |
| Cancel name edit | Esc | Reverts | — |
| Delete label | × on row hover (owner) | Row swaps to inline confirm | "Delete this label?" |
| Confirm delete | Yes | Removes label + sweeps card.labels | — |
| Cancel delete | Cancel / row blur | Reverts | — |
| Open create | Click "+ Create a new label" | Inline create row appears | — |
| Pick color (create) | Click swatch | Swatch outlined | — |
| Submit create | Enter / Create button | New label appended | — |
| Cancel create | Esc / Cancel | Row collapses | — |

Keyboard:
- Tab order inside picker: Row checkboxes → name fields (when in edit) → × delete → create button. Each row is one Tab stop on its checkbox by default.
- Enter on a focused row checkbox toggles (native checkbox behavior).

## 5. Animations

- Stripes appear instantly with the card (no per-stripe stagger; cheaper and less noisy at scale).
- Picker open follows the existing modal fade — no extra motion.
- Inline confirm row swap: instantaneous (no slide). Matches the existing kebab pattern.
- Create-row expand: 120ms `height auto` — but easier to ship as no-animation (just toggle); spec defaults to instant. If F-21 polish lands, animate then.

## 6. Edge cases

- **Long label names.** Input enforces 30-char max. Render uses `text-overflow: ellipsis` on `.label-name` so a long name in a 220px sidebar doesn't break the row.
- **Many labels.** Picker scrolls inside the sidebar slot — no fixed cap. The card preview already clips to 5 stripes.
- **Label deleted while card modal is open.** Modal re-reads from the store (board labels is a derived prop), so the deleted row vanishes on the next render. The toggled-on stripe also disappears from the preview.
- **Two stripes with identical color.** Allowed — names disambiguate via tooltip. Stripes render in `card.labels` order.
- **Storage roll-back on label add.** Same pattern as F-03 createBoard: not needed here since `addLabel` only mutates board state (no synchronous write requirement). Debounced write is fine.
- **Migration.** Existing boards in localStorage created before F-11 don't have a `labels` field. Hydrate-time migration: if `board.labels` is missing or not an array, populate with the default 6 unnamed labels using `BOARD_COLORS[0..5]`.

## 7. CSS tokens / classes

Reused: `--surface-02/04/05/08`, `--fg1/2/3/4`, `--brand-indigo`, `--border-subtle`, `--border-1/2`, `--bg-surface`, `BOARD_COLORS`.

New classes:

- `.label-stripes` — flex row, gap 4px, margin-bottom 8px.
- `.label-stripe` — 28×4, radius 2.
- `.label-stripes-more` — 10px mono, `--fg4`, self-aligned.
- `.label-picker` — flex column, gap 2px.
- `.label-row` — flex row, gap 8px, padding 4px 6px, radius 4px; hover `--surface-02`. Modifiers `.editing`, `.confirming`.
- `.label-checkbox` — 14×14, `--border-2` border; `:checked` fills `--brand-indigo`.
- `.label-swatch` — 16×16, radius 3.
- `.label-name` — flex 1, min-width 0, font-size 12, `--fg2`, ellipsis. `.empty` modifier = italic `--fg4`.
- `.label-name-input` — same metrics as `.col-title-input`, smaller.
- `.label-actions` — flex, gap 4, opacity 0 by default; row-hover → 1.
- `.label-delete-btn` — square 18, `--fg4`; hover `--danger`.
- `.label-confirm` — inline group: text + Yes/Cancel buttons (`.btn-subtle` size).
- `.label-create` — full-width dashed button, `--fg3`, hover `--fg1`. Opens to:
- `.label-create-form` — vertical stack: name input, swatch row, button row.
- `.label-create-swatches` — flex row, gap 6, swatch buttons 18×18 with `data-selected` outline.
- `.label-empty` — italic `--fg4`, font-size 12.

No new CSS custom properties.

## 8. Open questions for PO

None — task spec is explicit about default count (6), palette source (BOARD_COLORS), preview cap (5), and inline-confirm choice. Implementation proceeds.
