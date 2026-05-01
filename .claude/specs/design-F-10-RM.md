# F-10-RM — Remove card due date

## Goal

Drop due dates entirely. Retro stickies are observations captured in the moment;
they carry no scheduling semantics and no deadline. The `DueDatePill`,
`DueDateField`, and `dueDateStatus` utility are deleted without replacement.

---

## Removed surfaces

- `app/_components/DueDate.tsx` — delete the file entirely. Contains both
  `DueDatePill` (card preview chip) and `DueDateField` (modal sidebar slot).
- `app/_lib/dueDateStatus.ts` — delete entirely. Only consumer is `DueDate.tsx`.
  Exports `dueDateStatus`, `formatDueDate`, and the `DueDateStatus` type — all
  go with the file.
- `app/_components/CardDetailsModal.tsx` — remove:
  - `import { DueDateField } from "./DueDate"` line
  - `dueDate={card.dueDate}` and `dueComplete={card.dueComplete ?? false}` props
    passed to `<DueDateField>`
  - The entire `{/* F-10 slot */}` block: `<section className="cd-side-due">`,
    its `<h3>Due date</h3>` heading, and `<DueDateField …/>` child
- `app/_components/Card.tsx` — remove:
  - `import { DueDatePill } from "./DueDate"` line (line 7)
  - `<DueDatePill card={card} />` JSX node inside `.vote-row` (line 304)
- `app/_data/store.ts` — remove `setCardDueDate` and `toggleCardDueComplete`
  mutations.
- `app/_data/retro.ts` — remove `Card.dueDate` and `Card.dueComplete` fields.
- `app/globals.css` — see **CSS classes to remove** below.

---

## Card details modal sidebar after removal

The `.cd-side` aside currently stacks two sections: Due date → Archive/Actions
(Members and Labels were already removed by F-12-RM and F-11-RM). After
removing `.cd-side-due`, Archive/Actions is the sole surviving section.

The shared spacing rule at line 543:

```
.cd-side-due, .cd-side-archive { margin-bottom: 14px; }
```

loses its first selector. The rule should be collapsed to the single remaining
class: `.cd-side-archive { margin-bottom: 14px; }`. Keeping the rule is
correct — `cd-side-archive` still participates in the `cd-side > section:last-child
{ margin-bottom: 0; }` override, so it needs its own value when it is not the
last child. (For now it is always the last child, but keeping the rule is
defensive and costs nothing.)

The line 502 comment listing slot wrappers must drop `.cd-side-due` from the
enumeration. The `.cd-side-archive` `border-top` + `padding-top` at line 547
are unaffected — the archive section stays.

---

## Card preview cleanup

In `Card.tsx`, `.vote-row` currently reads left to right:

```
[DueDatePill] [checklist indicator] [desc indicator] [Voters] [VoteButton]
```

`DueDatePill` is the leftmost element. Removing it causes the checklist
indicator to become the new leftmost item — no spacer or flex-gap adjustment
is needed because `.vote-row` already uses `gap` from the existing flex rules
and the items are self-sizing. The row simply contracts from the left.

Post-removal vote-row:

```
[checklist indicator] [desc indicator] [Voters] [VoteButton]
```

In the read-only case the vote button is replaced by the `{card.voters.length}▲`
monospace span — that right-end slot is also unaffected.

---

## Microcopy / aria sweep

Grep for the following and confirm each is gone with `DueDate.tsx`,
`dueDateStatus.ts`, and their call sites:

- `"Due date"` — `<h3 className="cd-section-label">Due date</h3>` in
  `CardDetailsModal.tsx`
- `"Add due date"` — button copy on `.due-add` in `DueDateField`
- `"Mark complete"` / `"Mark incomplete"` — checkbox span copy in `DueDateField`
- `"Edit"` — `.btn.btn-subtle` label in `.due-field-actions`
- `"Clear"` — `.btn.btn-subtle` label in `.due-field-actions`
- `"No due date."` — `.cd-placeholder` text in the read-only empty branch
- `"Complete"` — `.due-field-complete-badge` read-only badge text
- `"Due date"` — `aria-label="Due date"` on the `<input type="date">` in
  `DueDateField`
- `"Due ${label}, ${status}"` (template string) — `aria-label` on `.due-pill`
  in `DueDatePill`
- `"${card.dueDate} — ${status}"` (template string) — `title` tooltip on
  `.due-pill`
- `"Edit due date"` — `title` on `.due-field-label-btn`
- `import { DueDatePill }` — dead import in `Card.tsx`
- `import { DueDateField }` — dead import in `CardDetailsModal.tsx`
- `from "./DueDate"` — expect exactly two hits (`Card.tsx`,
  `CardDetailsModal.tsx`); both removed
- `card.dueDate` / `card.dueComplete` — any remaining reference in store
  selectors, seed data, or tests
- `DueDateStatus` type — only defined and used within the two deleted files;
  confirm no external import
- `--warning` / `--warning-tint` — tokens were introduced by F-10 for the
  amber "today" pill state; no other component uses them. They should be
  removed from `:root` in `globals.css` alongside the CSS block below.

---

## CSS classes to remove

All rules are in the `/* ---------- card due date (F-10) ---------- */` block
(lines 866–1004 of `globals.css`). Remove the entire block:

- `.due-pill` (line 869)
- `.due-pill.today` (line 885)
- `.due-pill.overdue` (line 890)
- `.due-pill.complete` (line 895)
- `.due-field` (line 903)
- `.due-field .due-add` (line 908)
- `.due-field-row` (line 911)
- `.due-field-row.complete .due-field-label, .due-field-row.complete .due-field-label-btn` (lines 918–919)
- `.due-field-label` (line 923)
- `.due-field-label-btn` (line 927)
- `.due-field-label-btn:hover` (line 939)
- `.due-field-complete-badge` (line 943)
- `.due-field-input` (line 954)
- `.due-field-input:focus` (line 969)
- `.due-field-input:disabled` (line 973)
- `.due-field-actions` (line 977)
- `.due-field-actions label` (line 985)
- `.due-field-actions label input[type="checkbox"]` (line 992)
- `.due-field-actions .btn` (line 1000)

Also edit these two scattered rules:

- **Line 37–38** — remove `--warning` and `--warning-tint` from `:root`. These
  tokens were introduced solely by F-10 (`design-F-10.md` §7) and are consumed
  only by `.due-pill.today`. No surviving component references either token.
- **Line 502 comment** — remove `.cd-side-due` from the slot-list comment
  in the `/* card details modal (F-07 shell) */` banner.
- **Line 543 selector** — collapse `.cd-side-due, .cd-side-archive { … }` to
  `.cd-side-archive { margin-bottom: 14px; }`.

---

## Out of scope

- `Card.dueDate` and `Card.dueComplete` localStorage migration — handled by
  F-MIGRATE.
- Archive sidebar section and `ArchivedItemsPanel` — F-14-RM.
- Checklist indicator on the card preview — untouched here; belongs to F-09
  rename work.
- Any scheduling or deadline feature — not a retro-board concern.
