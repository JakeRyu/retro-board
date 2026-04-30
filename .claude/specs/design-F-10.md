# F-10 — Card due date

## 1. Feature recap

Per backlog F-10, a card can carry a single due date (date only, no time-of-day)
and a "complete" flag. The modal sidebar slot `.cd-side-due` (already reserved
in F-07) hosts the controls. The card preview gets a coloured pill summarising
the due-date status — neutral if the date is in the future, warning if today,
danger if overdue, muted with strikethrough when marked complete. v1 accepts
browser variance and uses the native `<input type="date">` instead of pulling
in a date-picker library.

## 2. Surface

- Modal sidebar slot `.cd-side-due` in `CardDetailsModal.tsx`. Section heading
  (`<h3 class="cd-section-label">Due date</h3>`) is already in place from F-07
  — this spec fills the body.
- Card preview pill (`.due-pill`) lives in `.card-foot > .vote-row`, immediately
  to the left of the description-indicator / voters / vote-button group. That
  keeps the existing right-aligned voter pile in its lane and lets the pill
  sit next to the assignee row above it without colliding.

## 3. States — sidebar slot (`.cd-side-due`)

| State | Visual |
|---|---|
| Empty (no `dueDate`) | Single `<button class="btn btn-subtle due-add">` with copy `Add due date`. Same height/padding as other `.btn-subtle` instances; full-slot width. |
| Set, future / today / overdue | Two-row layout. Row 1: date in human-readable format `Tue, May 5` (current year omitted; year shown only if not the current calendar year). Row 2: `.due-field-actions` with three controls — checkbox toggle `Mark complete`, `Edit` button, `Clear` button. |
| Set, complete | Same two-row layout, date label gets `text-decoration: line-through; color: var(--fg4)`. Toggle reads `Mark incomplete` and stays checked. Pill still shown on the preview, also struck-through. |
| Editing (picker open) | Native `<input type="date">` replaces the date label inline. Save on `change` (browser fires once user picks a date). `Esc` closes without saving (revert). Outside click also closes via blur. |
| Read-only (closed board) | All controls disabled. Empty case renders the placeholder text `No due date.` (muted, italic, like `.cd-placeholder`). Set case renders the date label and `Complete` text-only badge if applicable; no edit/clear/toggle controls. |

## 4. States — card preview pill (`.due-pill`)

Computed from `app/_lib/dueDateStatus.ts` which returns one of `'future' | 'today' | 'overdue' | 'complete'` from a card. Status drives a class modifier on the pill:

- `.due-pill.future` — neutral muted background (`--surface-04`, `--fg3`).
- `.due-pill.today` — warning. Uses a new `--warning` token (see §7) — amber-on-tinted-amber, mirroring how `.state-pill.open` tints with `--status-emerald`.
- `.due-pill.overdue` — danger. Tinted `--danger` background, `--danger-hi` text.
- `.due-pill.complete` — muted neutral with strikethrough text (`--fg4`, `text-decoration: line-through`). Wins over future/today/overdue when `dueComplete === true`.

Pill copy mirrors the sidebar's human-readable format (`Tue, May 5`). On overdue, no extra word — colour carries the meaning. Tooltip/`title` exposes the absolute ISO date (`title="2026-05-05 — overdue"`) for accessibility / power-users.

The pill is rendered for any card with `dueDate` set, including in read-only mode (so closed boards still surface what was due).

## 5. Interaction spec

### Sidebar (editable)

- **Add due date**: click `Add due date` button. Picker opens directly (mounts the native input, autofocuses, and on most browsers the picker pops). On `change`, store via `setCardDueDate`. No explicit Save button.
- **Edit**: click the `Edit` button or click the date label itself. Same flow as Add.
- **Clear**: click `Clear` → calls `setCardDueDate(boardId, cardId, undefined)`. Drops back to the empty state. No confirm — recoverable via re-add.
- **Mark complete / incomplete**: checkbox toggles `dueComplete` via `toggleCardDueComplete`. Toggling does NOT clear the date; complete + cleared are independent operations.
- **Esc** while picker open: revert (don't apply pending value), close the input, return focus to the originating control.
- **Tab order** within the slot: Add/Edit → Mark-complete checkbox → Clear button. (When empty, just the single Add button.)

### Pill (preview)

- Pill is non-interactive in v1 — display only. It does not open the modal directly; clicking the card body still opens the modal as per F-07 (the pill is inside the card body so the existing click target wins).
- Pill is excluded from the kebab/vote-button suppress list — the existing `target.closest('.kebab-trigger, .kebab-menu, .vote-btn, .card-edit-input')` guard already lets clicks on the pill bubble up and open the modal.

### Read-only (closed board)

- All controls disabled (`disabled` attribute, native + button). Pointer cursor reverts to default. The slot still renders the date so context is visible.

## 6. Helper: `app/_lib/dueDateStatus.ts`

Pure function. Compares the stored `YYYY-MM-DD` string against today's local date (no time-zone math beyond what `new Date()` does). Behavior:

- `card.dueComplete === true` → `'complete'` (always wins).
- No `dueDate` → return `null` (caller decides what to render — pill renders nothing, sidebar renders empty state).
- `dueDate < todayLocal` → `'overdue'`.
- `dueDate === todayLocal` → `'today'`.
- `dueDate > todayLocal` → `'future'`.

Date-only comparison uses the ISO `YYYY-MM-DD` lexicographic order (safe because the format is fixed-width). No `Date` object needed for the comparison itself; `new Date()` is only used to derive today's local YYYY-MM-DD.

## 7. CSS tokens used / introduced

Reused: `.btn`, `.btn-subtle`, `.btn-ghost`, `--surface-02/04/08`, `--fg1/2/3/4`, `--brand-indigo`, `--danger`, `--danger-hi`, `--border-subtle`.

New token: `--warning: #d4a04a;` (amber, sits between `--status-emerald` and `--danger` in our existing palette). Justified — F-15 (filter by due-date status) will need to surface "due this week" later, and the same colour belongs there. Adds one rgba-tinted halo too: `--warning-tint: rgba(212, 160, 74, 0.12)` for backgrounds. Both go in `:root`.

New classes:

- `.due-pill` — base. `display: inline-flex; align-items: center; gap: 4px; height: 18px; padding: 0 8px; border-radius: 9999px; font-size: 11px; font-weight: 510; border: 1px solid var(--border-subtle); background: var(--surface-04); color: var(--fg3);` Pill is small enough to sit comfortably in `.vote-row` without nudging the voter pile down.
- `.due-pill.future` — defaults from base (no override needed beyond the base).
- `.due-pill.today` — `background: var(--warning-tint); color: var(--warning); border-color: rgba(212,160,74,0.25);`
- `.due-pill.overdue` — `background: rgba(217,119,119,0.12); color: var(--danger-hi); border-color: rgba(217,119,119,0.25);`
- `.due-pill.complete` — `background: var(--surface-02); color: var(--fg4); border-color: var(--border-subtle); text-decoration: line-through;`
- `.due-field` — sidebar wrapper. `display: flex; flex-direction: column; gap: 6px;`
- `.due-field-row` — date display row. `display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--fg2);`
- `.due-field-row.complete` — applies `text-decoration: line-through; color: var(--fg4);` to the contained label only.
- `.due-field-input` — styled `<input type="date">`. Reuses `.field-input` rules from F-03 (height 30px, `--bg-surface` background, indigo focus border). One small tweak: `color-scheme: dark;` so the native picker matches the app palette.
- `.due-field-actions` — `display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 11px; color: var(--fg3);`
- `.due-field-actions label` (the Mark-complete checkbox row) — `display: inline-flex; align-items: center; gap: 6px; cursor: pointer;`
- `.due-field-actions .btn` — height collapses to 22px; same `.btn-subtle` colour.

## 8. Animations

- Pill colour transitions: 140ms ease on `background, color, border-color` so a status flip (e.g. when a date crosses midnight from "today" → "overdue") fades softly. (We don't manually re-render at midnight — the next mount picks up the new status. Acceptable for v1.)
- No open/close animation on the date input — native browser handles its own picker animation.

## 9. Edge cases

- **Stored date in the past, not complete**: pill is `overdue` red. Sidebar `Mark complete` is the obvious resolution.
- **Date input cleared from the picker** (some browsers allow setting to empty): treat as `Clear`.
- **Bad stored value** (corrupt persisted payload): `dueDateStatus` returns `null` for any string that doesn't match `^\d{4}-\d{2}-\d{2}$`. Sidebar treats it as empty; pill is suppressed.
- **Year boundary**: human-readable format includes year only when not the current calendar year (e.g. `Tue, May 5` vs `Tue, May 5, 2027`). Same rule applies to pill copy.
- **Anonymous mode**: due dates are board-data, not author-identity — no anonymisation. Pill renders normally.

## 10. Open questions for PO

None. The backlog is explicit on every behavioural choice; the only judgement call is the `--warning` token colour value, and the chosen amber is a calm dark-mode-native amber consistent with the rest of the palette.
