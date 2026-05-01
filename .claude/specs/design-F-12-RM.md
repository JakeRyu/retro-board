# F-12-RM — Remove card members (assignees)

## Goal

Drop the member/assignee system entirely. Voter avatars already show who
resonated with an observation; assignment is a task-ownership concept that
doesn't belong on a retro sticky.

---

## Removed surfaces

- `app/_components/Members.tsx` — delete the file entirely. Contains both
  `AssigneeAvatars` (card preview pile) and `MemberPicker` (modal sidebar
  picker).
- `app/_components/CardDetailsModal.tsx` — remove:
  - `import { MemberPicker } from "./Members"` line
  - `labels` and `assigneeIds` props passed to `MemberPicker`
  - The entire `{/* F-12 slot */}` block: `<section className="cd-side-members">`,
    its `<h3>` heading, and `<MemberPicker …/>` child
- `app/_components/Card.tsx` — remove:
  - `import { AssigneeAvatars } from "./Members"` line
  - The `{/* F-12: assignee pile … */}` comment block
  - The `<AssigneeAvatars users={users} assigneeIds={card.assigneeIds} anonymous={anonymous} />`
    JSX node (sits just above `.card-foot`)
- `app/_data/store.ts` — remove `toggleCardAssignee` mutation.
- `app/_data/retro.ts` — remove `Card.assigneeIds` field.
- `app/globals.css` — see **CSS classes to remove** below.

---

## Card details modal sidebar after removal

The `.cd-side` aside currently stacks four sections in order: Due date,
Labels, Members, Archive/Actions. After removing `.cd-side-members`, the
sequence becomes: Due date, Labels, Archive/Actions. The `margin-bottom:
14px` rule shared by `.cd-side-due`, `.cd-side-labels`, `.cd-side-members`,
`.cd-side-archive` (line 543) still works correctly for the surviving
sections — remove only `, .cd-side-members` from that comma-separated
selector. The `border-top` divider on `.cd-side-archive` stays. No visual
gap adjustment needed; the sections close naturally.

---

## Card preview cleanup

After F-13-RM shipped, the `.vote-row` in `Card.tsx` reads (left to right):

```
[DueDatePill] [checklist indicator] [desc indicator] [Voters] [VoteButton]
```

The `AssigneeAvatars` block does not live inside `.vote-row` — it is
rendered above `.card-foot` as a right-aligned flex row at the card body
level. Removing it contracts the card's internal vertical stack by one
element. The `.card-foot` and `.vote-row` are unaffected and do not
reorder. No spacer or reflow adjustment is needed; the card body (`card-body`)
simply extends to fill the reclaimed space per the existing `flex-direction:
column` layout.

---

## Microcopy / aria sweep

Grep and confirm each string is removed with `Members.tsx` and its call
sites:

- `"Members"` — `<h3 className="cd-section-label">Members</h3>` in
  `CardDetailsModal.tsx`
- `"Assignees"` — `aria-label="Assignees"` on the `.assignees` wrapper in
  `Members.tsx`
- `"Toggle ${u.name}"` (template string) — `aria-label` on each
  `.member-checkbox` in `MemberPicker`
- `"Add a member"` — verify not present as placeholder or tooltip; the
  original design-F-12.md spec did not add this string, but grep to confirm
- `"assigneeIds"` — prop name in `CardDetailsModal.tsx`, `Card.tsx`, and
  `Members.tsx`; ensure no dead references remain after deletions
- `card.assigneeIds` — any remaining reference in store selectors, seed
  data (`SEED_BOARD` / `SEED_BOARDS`), or tests
- `import { AssigneeAvatars }` and `import { MemberPicker }` — dead imports
  in `Card.tsx` and `CardDetailsModal.tsx`
- `import { Members }` — not present (named exports only), but grep for
  `from "./Members"` across the codebase; expect exactly two hits
  (`Card.tsx` and `CardDetailsModal.tsx`), both removed

---

## CSS classes to remove

All rules are in the `/* card members (F-12) */` block (lines 1026–1088 of
`globals.css`). Remove each full rule block:

- `.assignees` (line 1029)
- `.assignees .avatar` (line 1036)
- `.assignees .avatar:first-child` (line 1041)
- `.assignees-more` (line 1042)
- `.member-picker` (line 1052)
- `.member-row` (line 1056)
- `.member-row:hover` (line 1065)
- `.member-row:has(.member-checkbox:disabled)` (line 1066)
- `.member-row:has(.member-checkbox:disabled):hover` (line 1069)
- `.member-checkbox` (line 1072)
- `.member-checkbox:disabled` (line 1079)
- `.member-name` (line 1080)

Also edit line 502 comment (slot list in the F-07 shell banner comment) and
line 543 shared spacing selector: remove `, .cd-side-members` from both.

No new tokens introduced; no tokens shared with surviving components (all
member/assignee styles are self-contained in this block).

---

## Icon cleanup

`Icon name="user"` is retained. It is called from `RetroApp.tsx` for the
anonymous-mode banner (`<Icon name="user" size={13} />`). `Members.tsx` does
not use `Icon` at all — it uses the `Avatar` primitive directly. No icon
definition in `Primitives.tsx` is orphaned by this removal.

---

## Out of scope

- `Card.assigneeIds` localStorage migration — handled by F-MIGRATE.
- Due date, labels, and archive sidebar sections — separate cleanup specs
  (F-10-RM, F-11-RM, F-14-RM).
- Any future facilitator-assignment feature — deferred, requires new design.
- `CardDetailsModal.tsx` prop surface for `labels` and `canEdit` — these
  belong to the Labels section (F-11-RM) and are not touched here.
