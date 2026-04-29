# F-03 — Create-board dialog

## 1. Feature recap

A modal dialog launched from the boards-list page (`/`) `Create board` CTA and from the sidebar's `Boards` action. The user picks a title, board type (Kanban or Retro), an optional retro-only theme prompt, and one of the seeded `BOARD_COLORS` swatches. Submit creates the board with the type's default columns, persists it via the F-01 store, and navigates to `/boards/[id]` (F-04). Cancels close the dialog without side effects. Visually it extends the existing `.modal` pattern used for the close-board confirm in `RetroApp.tsx`, so the two dialogs feel like one family.

## 2. Visual layout

Reuses `.modal-overlay` + `.modal` exactly as the close-board confirm does — same overlay opacity, same `--bg-surface` panel, `--shadow-dialog`, 12px radius, 22px padding, 150ms enter transition.

**Width.** Bumped from 420px to **460px** to fit the segmented control + color swatch row without crowding. Still `max-width: 92vw`. Add a `.modal.modal-create` modifier so the close-confirm modal stays at 420px.

**Vertical stack** inside the panel (top → bottom):

```
┌─ .modal.modal-create ──────────────────────────────┐
│  h2  Create a new board                            │
│                                                    │
│  label  Title                                      │
│  [ input ........................................] │
│  (helper / error line)                             │
│                                                    │
│  label  Type                                       │
│  [  Kanban  |  Retro  ]   ← .segmented            │
│                                                    │
│  label  Theme prompt   (only when Retro)           │
│  [ textarea ............... ]                      │
│                                                    │
│  label  Color                                      │
│  [● ○ ○ ○ ○ ○]   ← .color-swatch-grid              │
│                                                    │
│  ─────────────────────────────────────────────     │
│  .modal-actions:        [Cancel]  [Create board]   │
└────────────────────────────────────────────────────┘
```

Field block spacing: 14px between blocks. Labels 11px / 510 / `--fg4` uppercase 0.7px tracking (matches `.theme-bar .label`). The `.modal-actions` row keeps the existing right-aligned 8px-gap pattern.

## 3. Field order and behavior

1. **Title** — `<input type="text">`. Placeholder `e.g. Sprint 25 — payments v3`. Required, trimmed before validation, ≥ 1 char, ≤ 80 chars. Reuses the `.add-card-input` visual treatment scaled down to a single line: `--bg-surface` background, `--border-2` border, focus ring `0 0 0 3px rgba(94,106,210,0.15)` plus `--brand-indigo` border. Autofocused when dialog opens. Enter submits.

2. **Type** — segmented control (`.segmented`), two options: `Kanban` | `Retro`. Default Kanban. Visual treatment: a single pill-shaped track using the `.anon-toggle` family of tokens (rounded 9999px, `--surface-02` background, `--border-1` border) with a sliding indigo tint behind the active option. Width fills the row but caps at 220px so it reads as a control, not a bar. Keyboard: Tab moves into the group; ←/→ switches between options; Space/Enter activates. Switching to Retro reveals the theme prompt block with an animated expand (see §5). Switching back to Kanban collapses it; the typed value is **kept** in state so toggling doesn't lose work.

3. **Theme prompt** — `<textarea>`, retro-only. Placeholder `What's this retro about? Stay specific — talk about behaviors, not people.` Optional (no validation). Min height ~60px, autosize up to ~140px then scroll. Reuses `.add-card-input` styling. Wrapped in a `.theme-prompt-collapse` element that animates in/out (see §5).

4. **Color** — 7 swatches in a single row (full `BOARD_COLORS` palette), `.color-swatch-grid`. One must be selected; default is **randomized from the palette at dialog-open** so newly-created boards in succession don't all look the same. Each swatch is a 22px circle with the swatch color as `background`, 1px transparent border. Selected state: 2px ring in `--brand-indigo` at 2px offset (matches `.crumb-link:focus-visible` outline pattern), plus the swatch grows to 24px. Keyboard: Tab into group; ←/→ navigates; Space/Enter selects. Row width: 7×22 + 6×10 = 214px — fits in the 460px panel.

## 4. States

- **Empty (initial open).** Title empty and focused. Type = Kanban. Theme prompt hidden. Color = random palette pick. `Create board` button is **enabled** (we validate on submit, not on every keystroke — calmer than disabling everything until 1 char) but submitting an empty title produces the validation error in §6.
- **Default / typing.** No helper line shown; title input shows live char counter only when length ≥ 60 of 80, right-aligned under the input as `60/80` in `--fg4` font-mono (matches the existing keyboard-hint style). Counter turns `--brand-violet-hi` at 70+ and `#d97777` at 81+.
- **Validation error.** `Title is required.` (when blank/whitespace-only on submit) or `Title is too long — 80 characters max.` (when > 80). Shown on the helper line under the title input in `#d97777` 11px. Input border becomes `#d97777`, focus ring tinted red. Cleared on next keystroke.
- **Submitting.** `Create board` button shows label `Creating…` and disables (also disables Cancel and the form fields) for ~120ms before navigation, even though the localStorage write is synchronous — gives the user a confirmation beat. Spinner is **not** shown (would be longer than the operation). When real network lands this state already exists.
- **Success.** Dialog fades out (`.modal-overlay` removes `.open` → 150ms opacity), router pushes `/boards/[id]`. No toast — arrival on the new board is the confirmation.
- **Error (write failed).** Out-of-quota localStorage is the only realistic failure. Inline message above the action row: `Couldn't save — your browser's storage is full.` in `#d97777`. Dialog stays open. Out of v1 scope to design a recovery path; flag in §9.

## 5. Animations

- **Open.** Inherit `.modal-overlay`'s 150ms opacity + `.modal`'s `translateY(-4px → 0)` 150ms.
- **Theme prompt reveal.** When type flips to Retro: max-height `0 → 180px` + opacity `0 → 1` + margin-top `0 → 14px`, all 180ms ease-out. Reverse on flip back to Kanban (collapse). Matches the existing 180ms collapse cadence (`.theme-bar.collapsed`, HANDOVER §4.4).
- **Segmented indicator slide.** The active-option background slides between segments in 150ms ease (matches the 150ms `.anon-toggle` switch transition).
- **Color swatch select.** 120ms ease for ring + size change. Same easing as `.board-card-star`.
- **Reduced motion.** Inherits — all of the above are `transition` / `transform`, so `prefers-reduced-motion` instantly applies once F-21's media query lands. No per-component opt-out needed in F-03.

## 6. Keyboard & dismissal

- **Open.** Title input is autofocused (use a ref + `useEffect` on open).
- **Tab order.** Title → segmented (Kanban/Retro as a single tab stop, ←/→ switches) → theme prompt (skipped when hidden) → color swatch group (single tab stop, ←/→ navigates) → Cancel → Create board. Reverse on Shift+Tab.
- **Enter on title.** Submits. Enter inside the textarea inserts a newline (default textarea behavior).
- **Esc.** Cancels. Same handler as overlay click. Returns focus to the trigger that opened the dialog (boards-list `Create board` button or sidebar trigger).
- **Overlay click.** Cancels. The `.modal` itself uses `e.stopPropagation()` like the close-board confirm.
- **Focus trap.** The dialog must trap focus while open (Tab from `Create board` wraps to title; Shift+Tab from title wraps to `Create board`). Implementation note for developer: simplest approach is a `focus-trap-react`-style util or a manual sentinel; either is fine. Flag if scope creeps.

## 7. Default columns clarification

These are **not shown** in the dialog. They're the implicit defaults the store applies based on the chosen type:

- **Kanban:** `To do` / `In progress` / `Done`
- **Retro:** `What went well` / `What didn't` / `Try next time` / `Shout-outs`

Rationale for keeping them out of the UI: showing them invites users to edit pre-creation, which then needs validation, ordering, and a "skip" path. Cheaper to default-and-edit-after via F-05.

## 8. Microcopy bank

| Slot | Copy |
|---|---|
| Dialog title (`h2`) | `Create a new board` |
| Title field label | `Title` |
| Title placeholder | `e.g. Sprint 25 — payments v3` |
| Title char-count | `N/80` (font-mono, shown ≥ 60) |
| Title error — empty | `Title is required.` |
| Title error — long | `Title is too long — 80 characters max.` |
| Type field label | `Type` |
| Segmented option 1 | `Kanban` |
| Segmented option 2 | `Retro` |
| Theme prompt label | `Theme prompt` |
| Theme prompt placeholder | `What's this retro about? Stay specific — talk about behaviors, not people.` |
| Color field label | `Color` |
| Cancel CTA | `Cancel` |
| Submit CTA — idle | `Create board` |
| Submit CTA — submitting | `Creating…` |
| Storage-full error | `Couldn't save — your browser's storage is full.` |

Voice: title sentence-case, labels Title-case, no exclamation marks, consistent with the close-board confirm and HANDOVER §4.6.

## 9. CSS tokens used / introduced

Reused: `.modal-overlay`, `.modal`, `.modal-actions`, `.btn .btn-primary`, `.btn .btn-ghost`, `.add-card-input` (treatment for title and textarea), `--bg-surface`, `--border-1/2`, `--border-subtle`, `--border-standard`, `--brand-indigo`, `--brand-violet-hi`, `--fg1/2/3/4`, `--surface-02/04/05/08`, `--shadow-dialog`.

New, all justified:

- **`.modal.modal-create`** — width override (460px). Justified: close-confirm should stay at 420px; named modifier avoids touching shared `.modal`.
- **`.field`** — wrapper div for `label + control + helper`. 14px bottom margin, flex column, gap 6px. Justified: appears 4× in this dialog and will repeat in F-07 / F-17 dialogs.
- **`.field-label`** — 11px / 510 / `--fg4` uppercase 0.7px tracking. Mirrors `.theme-bar .label` but at field scale.
- **`.field-helper`** — 11px / `--fg4`. Inherits red `#d97777` via `.field-helper.error`.
- **`.segmented`** — pill track, `--surface-02` bg, 1px `--border-1`, radius 9999px, `display: inline-flex`, padding 2px, position relative, height 30px to match `.btn`.
- **`.segmented-option`** — flex 1, padding 0 14px, font 12px / 510 / `--fg3`, border 0, background transparent, z-index 1, transition color 150ms.
- **`.segmented-option[aria-selected="true"]`** — color `--fg1`.
- **`.segmented-indicator`** — absolute pill behind active option, `rgba(94,106,210,0.18)` background, 1px `rgba(94,106,210,0.4)` border (mirrors `.anon-toggle[data-on="true"]`), radius 9999px, transition `transform 150ms ease, width 150ms ease`.
- **`.color-swatch-grid`** — flex row, gap 10px, padding 2px 0.
- **`.color-swatch`** — 22px circle button, `border: 1px solid rgba(255,255,255,0.08)`, transition `transform 120ms, box-shadow 120ms`. Background set inline from palette hex.
- **`.color-swatch[aria-pressed="true"]`** — `box-shadow: 0 0 0 2px var(--bg-surface), 0 0 0 4px var(--brand-indigo)` (inner ring matches modal bg so the outer ring reads as a halo), `transform: scale(1.08)`.
- **`.color-swatch:focus-visible`** — same ring as pressed but uses `--fg2` instead of indigo so focus and selection are distinguishable.
- **`.theme-prompt-collapse`** — wrapper for the textarea field; `overflow: hidden`, transitions on `max-height`, `opacity`, `margin-top`. JS toggles a `.open` modifier on type change.

No new CSS custom properties. No new colors.

## 10. PO decisions

1. **Palette size — ship all 7 swatches.** The palette in `app/_data/retro.ts` is the source of truth (per F-02 PO decision #5). The row fits comfortably in 460px and shrinking the palette would force an arbitrary cut and ripple into F-01's seed-color logic. Update the §3 "Color" copy and §9 grid notes from "6 swatches" to "7 swatches"; default selection remains a random pick at dialog-open. Backlog AC for F-03 updated to reference the full `BOARD_COLORS` palette.

2. **Sidebar `Create board` trigger — `+ Create board` row at the top of the `Boards` sidebar section.** Matches the designer's recommendation. Reuses `.side-item` styling so it reads as a peer of the existing rows but with a leading `+` glyph; clicking opens the same dialog as the boards-list CTA. Single canonical entry point per surface — no duplicate trigger inside individual board views (use the boards-list page or sidebar).

3. **Storage-full failure path — inline error only for v1.** No "manage archived boards" link; the archive panel doesn't exist until F-17 and v1 users are nowhere near 5MB. The inline message in §6 is sufficient. Revisit when F-17 lands.

4. **Trigger return-focus backfill — F-03 only; do not backfill close-board confirm now.** Keep scope tight. Add a HANDOVER note flagging the close-board confirm as a follow-up so it's picked up when F-17's settings menu touches that surface. Do not block F-03 on it.
