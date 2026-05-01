# F-11-RM — Remove card labels

## Goal

Drop the entire label system. In a retro the column prompt is the category;
labels duplicate that signal while adding per-board configuration overhead.
Zero-setup is the right default.

---

## Removed surfaces

- `app/_components/Labels.tsx` — delete the file entirely. Contains
  `LabelStripes`, `LabelPicker`, `LabelRow`, `LabelCreateForm`.
- `app/_components/CardDetailsModal.tsx` — remove:
  - `import { LabelPicker } from "./Labels"` line
  - `import type { … Label … }` — remove `Label` from the type import
  - `labels: Label[]` and `canEdit: boolean` props from `CardDetailsModalProps`
  - Corresponding destructured parameters in the function signature
  - The entire `{/* F-11 slot */}` block: `<section className="cd-side-labels">`,
    its `<h3>Labels</h3>` heading, and `<LabelPicker …/>` child
- `app/_components/Card.tsx` — remove:
  - `import { LabelStripes } from "./Labels"` line
  - `labels: Label[]` prop from both `CardProps` and `CardViewProps` interfaces
  - `import type { Label … }` — remove `Label` from the type import
  - The `<LabelStripes labels={labels} cardLabelIds={card.labels} />` JSX node
    (line 268, sits between the top-voted flag and the edit/body block)
  - The `labels` prop forwarded from `Card` to `CardView`
- `app/_components/BoardSettingsMenu.tsx` — remove:
  - `import { LabelPicker } from "./Labels"` line
  - `import type { … Label … }` — remove `Label` from the type import
  - `onManageLabels: () => void` prop from `BoardSettingsMenuProps`
  - Corresponding destructured parameter
  - `const showManageLabels = …` derived boolean
  - The `{showManageLabels && (<button …>Manage labels</button>)}` JSX block
  - The entire `ManageLabelsModal` component (bottom of the file) and its
    `ManageLabelsModalProps` type — delete both
- `app/_data/retro.ts` — remove (see Data model section below).
- `app/globals.css` — see **CSS classes to remove** below.

---

## Card details modal sidebar after removal

The `.cd-side` aside currently stacks: Due date → Labels → Archive/Actions.
After removing `.cd-side-labels`, the sequence becomes: Due date →
Archive/Actions. F-12-RM already removed Members; this is the second section
gone from the sidebar. The shared spacing rule on line 543 —

```
.cd-side-due, .cd-side-labels, .cd-side-archive { margin-bottom: 14px; }
```

— must have `, .cd-side-labels` removed from the selector. The two surviving
sections (Due date, Archive/Actions) keep their `margin-bottom: 14px` and
the existing `border-top` + `padding-top` on `.cd-side-archive` stays. No
visual gap adjustment needed. The comment on line 502 that lists the slot
wrappers should also drop `.cd-side-labels` from the enumeration.

The `labels` and `canEdit` props that `RetroApp.tsx` (or equivalent parent)
passes into `<CardDetailsModal>` are also removed at the call site.

---

## Card preview cleanup

In `Card.tsx`, `<LabelStripes>` sits between the `.top-voted-flag` and the
edit textarea / `.card-body` block. Its removal is a clean vertical-stack
contraction: the card body rises to fill the gap, no spacer needed.

After F-13-RM shipped and F-12-RM shipped, the card preview no longer has
comment indicators or assignee avatars. The `labels` prop on `CardView` /
`Card` is the only remaining removal from the card's data interface in this
spec; the vote-row itself (`DueDatePill`, checklist indicator, desc indicator,
voters, vote button) is untouched here — those belong to F-10-RM and later.

---

## Board settings menu adjustment

`BoardSettingsMenu.tsx` currently shows:

```
Edit theme prompt   (retro + open + not archived)
Manage labels       (not closed + not archived)
Copy action items   (retro exports)
Copy full retro summary
Archived items      (always, for owner)
── divider ──
Reopen / Unarchive / Archive board
```

After removing `showManageLabels` and its button, the menu becomes:

```
Edit theme prompt   (retro + open + not archived)
Copy action items   (retro exports)
Copy full retro summary
Archived items      (always, for owner)
── divider ──
Reopen / Unarchive / Archive board
```

The `ManageLabelsModal` component (same file, bottom) is also deleted in
full — it wraps `LabelPicker` in management mode and has no other purpose.
The `onManageLabels` prop is removed from the component interface; callers
in `RetroApp.tsx` (or wherever `BoardSettingsMenu` is mounted) drop that
prop and any associated state (`manageLabelsOpen`, etc.).

Note: "Archived items" stays for now — F-14-RM has not shipped yet. Do not
pre-empt that removal here.

---

## Data model and seed cleanup

- **`Label` type** (`retro.ts` lines 16–20) — remove the entire type definition.
- **`Card.labels?: string[]`** (`retro.ts` line 31) — remove the field.
- **`Board.labels: Label[]`** (`retro.ts` line 66) — remove the field.
- **`defaultLabels()` function** (`retro.ts` lines 100–106) — remove entirely.
- **`BOARD_COLOR_NAMES` constant** (`retro.ts` lines 87–95) — remove entirely.
  Verdict: `BOARD_COLORS` (the array, lines 75–83) is used for board theming
  (`Board.color` picks from this array at board creation). `BOARD_COLOR_NAMES`
  is a parallel `Record<string, string>` used only as fallback tooltip text in
  `Labels.tsx` (`labelTooltip`) and as `aria-label` in `LabelCreateForm`.
  Neither call site survives F-11-RM. `BOARD_COLORS` is unaffected — leave it.
- **`SEED_BOARD.labels`** — remove `labels: defaultLabels()` line (line 236).
- **`SEED_BOARD_KANBAN.labels`** — remove `labels: defaultLabels()` line
  (line 283). (This board is also removed by F-TYPE-RM; either cleanup can do
  it, but F-11-RM removes the field first.)
- **`SEED_BOARD_CLOSED.labels`** — remove `labels: defaultLabels()` line (line 299).
- **`SEED_BOARD_ARCHIVED.labels`** — remove `labels: defaultLabels()` line (line 315).

---

## Microcopy / aria sweep

Grep for the following and confirm each is gone with `Labels.tsx` and its
call sites. None of these strings have a second home.

- `"Labels"` — `<h3 className="cd-section-label">Labels</h3>` in
  `CardDetailsModal.tsx`
- `"Manage labels"` — menu button label in `BoardSettingsMenu.tsx`; also
  `aria-label="Manage labels"` on the `ManageLabelsModal` dialog
- `"No labels yet. Create one."` — `.label-empty` placeholder in
  `LabelPicker` (also rendered as `<p className="label-empty">`)
- `"+ Create a new label"` — `.label-create` button label
- `"Add a name…"` — placeholder on `.label-name-input` in `LabelRow` and
  `LabelCreateForm`; verify no other component uses this exact string
- `"Delete this label?"` — confirm copy in `LabelRow`
- `"Delete label"` — `title` and `aria-label` on `.label-delete-btn`
- `"Label color"` — `aria-label` on the swatch radiogroup in
  `LabelCreateForm`
- `"Toggle ${label.name}"` / `"Toggle unnamed label"` — `aria-label` on
  `.label-checkbox` in `LabelRow`
- `"Labels"` — `aria-label` on `.label-stripes` wrapper in `LabelStripes`
- `"Unnamed"` / `"Unnamed (${colorName})"` — tooltip fallback in
  `labelTooltip()`; gone with the file
- `import { LabelPicker }` / `import { LabelStripes }` — dead imports in
  `CardDetailsModal.tsx`, `Card.tsx`, `BoardSettingsMenu.tsx`
- `from "./Labels"` — expect exactly three hits across the codebase
  (`Card.tsx`, `CardDetailsModal.tsx`, `BoardSettingsMenu.tsx`); all removed
- `card.labels` — any remaining reference in store selectors, seed data, or
  tests
- `board.labels` — any remaining reference in store, seed data, or tests
- `BOARD_COLOR_NAMES` — should only appear in `retro.ts` (definition) and
  `Labels.tsx` (two uses); both gone
- `data-testid` attributes containing `label` or `stripe` — scan and remove
  with the file

---

## CSS classes to remove

All rules are in the `/* ---------- card labels (F-11) ---------- */` block
(lines 866–1024 of `globals.css`) plus two scattered references. Remove the
full rule block for each:

- `.label-stripes` (line 868)
- `.label-stripe` (line 875)
- `.label-stripes-more` (line 880)
- `.label-picker` (line 887)
- `.label-empty` (line 891)
- `.label-row` (line 897)
- `.label-row:hover` (line 906)
- `.label-row.editing` (line 907)
- `.label-row.confirming` (line 908)
- `.label-checkbox` (line 910)
- `.label-checkbox:disabled` (line 917)
- `.label-swatch` (line 919)
- `.label-name` (line 925)
- `.label-name.empty` (line 934)
- `.label-name-input` (line 936)
- `.label-actions` (line 947)
- `.label-row:hover .label-actions`, `.label-row:focus-within .label-actions`
  (lines 952–953)
- `.label-delete-btn` (line 955)
- `.label-delete-btn:hover` (line 965)
- `.label-confirm-text` (line 967)
- `.label-confirm-actions` (line 972)
- `.label-confirm-actions .btn-subtle` (line 975)
- `.label-confirm-yes` (line 976)
- `.label-create` (line 978)
- `.label-create:hover` (line 989)
- `.label-create-form` (line 995)
- `.label-create-form .label-name-input` (line 1004)
- `.label-create-swatches` (line 1005)
- `.label-create-swatch` (line 1008)
- `.label-create-swatch[data-selected="true"]` (line 1018)
- `.label-create-actions` (line 1021)
- `.label-create-actions .btn` (line 1024)

Also edit these two scattered rules:

- **Line 502 comment** — remove `.cd-side-labels` from the slot-list comment
  in the `/* card details modal (F-07 shell) */` banner.
- **Line 543 selector** — remove `, .cd-side-labels` from
  `.cd-side-due, .cd-side-labels, .cd-side-archive { margin-bottom: 14px; }`.
- **Line 1715** — remove `.label-picker.manage-only .label-checkbox { display: none; }`
  (the single rule in the "Manage labels modal" comment block at the bottom of
  the file).

No new tokens introduced. No surviving component references any of the
removed classes.

---

## Out of scope

- `Card.labels` and `Board.labels` localStorage migration — handled by
  F-MIGRATE.
- Due date sidebar section (`cd-side-due`, `DueDateField`, `DueDatePill`) —
  F-10-RM.
- Archive sidebar section and `ArchivedItemsPanel` — F-14-RM.
- "Archived items" entry in `BoardSettingsMenu` — F-14-RM.
- `BOARD_COLORS` array — untouched; used by board theming (`Board.color`).
- Store mutations `addLabel`, `updateLabel`, `deleteLabel`, `toggleCardLabel`
  — implementation concern for the developer; this spec only defines what
  surfaces are removed.
- Any future tagging or theming system.
