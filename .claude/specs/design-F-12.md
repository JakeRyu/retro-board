# F-12 — Card members assigned

## 1. Feature recap

Cards carry an optional list of assignee user ids (`Card.assigneeIds: string[]`,
already typed in F-01). F-12 ships:

- A `MemberPicker` in the card details modal's `.cd-side-members` slot.
  Replaces the F-07 placeholder.
- An assignee avatar stack on the card preview (bottom-right of `.card`),
  capped at 3 with a `+N` overflow pill.
- Anonymous-mode masking on the preview only (avatar shows `?`); the picker
  itself stays legible.

Source of members in v1: the seeded `USERS` list. "Board members" === all
`USERS` until the backend lands.

## 2. Modal sidebar — `.cd-side-members`

Heading stays `Members` (`.cd-section-label`).

```
┌─ .member-picker ────────────────┐
│ [☑]  ●  You                     │  ← .member-row, checked
│ [ ]  ●  Maya                    │
│ [☑]  ●  Jordan                  │
│ [ ]  ●  Priya                   │
│ ...                             │
└─────────────────────────────────┘
```

- Row anatomy (`.member-row`):
  - Checkbox 14×14, indigo accent. Reuses `.label-checkbox` sizing/treatment;
    no new checkbox class — alias `.member-checkbox` for selector clarity.
  - Avatar via the existing `Avatar` primitive at `size={20}` (`.member-avatar`
    just sets margin/flex hooks; visuals come from `Avatar`).
  - Name text — 12px, `--fg2`, ellipsis on overflow.
- Whole row is a `<label>` so a click anywhere toggles the checkbox.
- Read-only board: every checkbox `disabled`; row loses hover affordance.

### Search/filter
**Skipped in v1.** With 7 USERS the row list is short and fits the 220px
sidebar without scrolling. A search input would only be noise. When member
count grows past ~12 add a text filter at the top of the picker (matching
on `name` case-insensitively). Documented; not implemented.

## 3. Card preview — `.assignees`

Renders **inside `.card`, bottom-right**, on the same row as the existing
voter row. The card foot already pins the author to the left and the vote
row to the right; assignees are a *separate* avatar pile that lives between
`.card-foot` and the vote row would crowd them. Cleaner placement: a thin
`.assignees` row positioned absolutely at `bottom: 6px; right: 8px` of the
card, **above** `.card-foot` (negative margin from the foot or absolute
positioning are both fine — go absolute so `.card-foot` content doesn't
re-flow when assignees appear).

Stack uses the same negative-margin overlap pattern as `.voters` but
mirrored — first avatar carries no offset, subsequent avatars `margin-left:
-4px`. Avatars are 18×18 (slightly bigger than the 16×16 voter avatars so
they read as a different concern at a glance). Border treatment matches
`.voters .avatar` (1.5px solid `--bg-marketing`) for visual cohesion.

- Max 3 avatars visible. If `assigneeIds.length > 3`, render the first 3 and
  append `<span class="assignees-more">+N</span>` (same chip as
  `.voters-more`).
- Hidden when `assigneeIds` is empty/undefined.
- Stale ids (user no longer in `USERS`) are silently dropped at render time.

### Layout safety
The `.card` already has `position: relative`. `.card-foot` carries the
voter row in `.vote-row`, pinned to the right. The new `.assignees` block
sits at `position: absolute; bottom: 6px; right: 8px` and has
`pointer-events: none` so it doesn't intercept clicks (a click on the card
still opens the modal). To keep the body text from running under it,
`.card-body` gets `padding-right` only when assignees are present — trivial
via a `.card[data-has-assignees="true"]` modifier or simply a fixed
`min-height` on `.card-foot` so it never collides. Cleanest: add
`min-height: 22px` to `.card-foot` and place `.assignees` *inside* `.card`
above `.card-foot` with `align-self: flex-end`. Implementer chooses.

## 4. Anonymous mode

Mirrors the voter-avatar masking pattern.

- **Card preview:** when `anonymous` is on, every assignee avatar renders
  as the existing `?` placeholder (`background: var(--surface-08); color:
  var(--fg3); font-size 8px`) instead of the user's real avatar.
- **Modal picker:** names ARE visible. Assigning a card is a deliberate act
  ("I'm putting Jordan on this") and is distinct from anonymous voting
  ("nobody knows who voted"). Hiding names in the picker would prevent the
  user from doing the assignment at all. **Document this as the deliberate
  exception** — anonymous mode is about hiding *attribution on cards*, not
  about hiding the team roster.

## 5. Read-only state

- Picker still renders so the reader can see who's on the card.
- Checkboxes `disabled`; rows lose hover affordance.
- Card preview avatars unchanged (read-only doesn't mask attribution).

## 6. Store

New action: `toggleCardAssignee(boardId, cardId, userId)`.

- Toggle membership in `card.assigneeIds`.
- Drop the field entirely when empty (matches `toggleCardLabel` pattern so
  persisted shape stays minimal).
- Bump `board.updatedAt` via the existing `updateBoardById` → `touch` path.

## 7. CSS classes (new)

- `.assignees` — flex row, gap 0, avatars overlap via negative margin.
  Positioned absolute bottom-right inside `.card`. `pointer-events: none`.
- `.assignees .avatar` — 18×18, 1.5px solid `--bg-marketing` border,
  `margin-left: -4px` except first.
- `.assignees-more` — same chip metrics as `.voters-more`.
- `.member-picker` — flex column, gap 2px (mirrors `.label-picker`).
- `.member-row` — flex row, gap 8px, padding 4px 6px, radius 4, hover
  `--surface-02`. Cursor pointer when not read-only.
- `.member-checkbox` — alias of `.label-checkbox` styles.
- `.member-name` — flex 1, min-width 0, font-size 12, `--fg2`, ellipsis.

No new tokens.

## 8. Out of scope / punted

- Search/filter inside picker (see §2). Skipped at 7 users.
- Real invites — backlog "members are local stubs."
- Filter-by-member surfaces in F-15, not here.
