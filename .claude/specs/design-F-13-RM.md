# F-13-RM — Remove card comments

## Goal

Strip async comment threads from the card details modal and the card preview.
Discussion mode is the conversation surface for a retro; threaded comments are
a kanban-async pattern with no role in a synchronous meeting.

---

## Removed surfaces

- `app/_components/Comments.tsx` — delete the file entirely.
- `app/_components/CardDetailsModal.tsx` — remove:
  - `import { Comments } from "./Comments"` line
  - `comments` prop from `CommentsProps` / any `card.comments` reference
  - The entire `{/* F-13 slot */}` block: `<section className="cd-comments">` and
    its `<h3>` and `<Comments …/>` children
- `app/_components/Card.tsx` — remove:
  - `const commentCount = card.comments?.length ?? 0` derived value
  - `const hasComments = commentCount > 0` derived value
  - The `{hasComments && (<span className="card-comment-indicator" …>…</span>)}` JSX block
- `app/_data/store.ts` — remove `addComment`, `editComment`, `deleteComment`
  mutations (verify exact names in the file before deleting).
- `app/_data/retro.ts` — remove the `Comment` type, the `Card.comments` field.
- `app/globals.css` — see **CSS classes to remove** below.

---

## Card details modal layout after removal

The `.cd-main` column currently stacks three sections top-to-bottom: Description,
Checklist, Comments. After the `cd-comments` section is removed, the column
ends at Checklist. Description and Checklist remain adjacent with their existing
`margin-bottom: 18px` gap between them — no visual gap adjustment is needed.
The modal's scrollable `.cd-grid` area will be shorter when those sections have
little content, but the modal already has no enforced min-height on the content
area; it settles naturally. No filler, no placeholder, no empty state in place
of the removed section. The sidebar (`cd-side`) is unaffected by this change.

---

## Card preview cleanup

In `Card.tsx` the `.vote-row` currently renders (left to right):
`[DueDatePill] [checklist indicator] [desc indicator] [comment indicator] [Voters] [VoteButton]`

After removing the comment indicator the row becomes:
`[DueDatePill] [checklist indicator] [desc indicator] [Voters] [VoteButton]`

The `.vote-row` is a flex row with `gap: 6px`; losing one element contracts
the row by one icon-width and the remaining items close the gap automatically.
No spacer, no reordering of the surviving elements.

Note: `DueDatePill`, `LabelStripes`, and `AssigneeAvatars` are each removed by
their own cleanup specs (F-10-RM, F-11-RM, F-12-RM). This spec only removes the
comment indicator; do not pre-empt those removals here.

---

## Microcopy / aria sweep

Grep the following strings and confirm each is removed with `Comments.tsx` and
its call sites. None of these strings exist outside the comments system.

- `"Write a comment…"` — composer `<textarea>` placeholder
- `"Write a comment"` — `aria-label` on the composer textarea (line 124 of `Comments.tsx`)
- `"Comment actions"` — `aria-label` on the per-row kebab trigger (line 355)
- `"Edit comment"` — `aria-label` on the edit textarea (line 294)
- `"Delete this comment?"` — inline confirm copy (line 329)
- `"No comments."` — read-only empty state inside `<p className="cd-placeholder">` (line 55)
- `"1 comment"` / `"N comments"` — `aria-label` and `title` on `.card-comment-indicator`
  in `Card.tsx` (lines 351–355)
- `"Send"` — button label; check it only appears in `Comments.tsx`; if it is
  reused elsewhere that instance is not touched
- `"edited"` — inline `<span className="comment-edited">` text (line 269); confirm
  it does not appear in any other component before removing
- `import { Comments }` — dead import in `CardDetailsModal.tsx` (line 6)
- `import type { Comment` — partial import in `Comments.tsx` (gone with the file);
  also check `retro.ts` re-export if the type is re-exported
- `card.comments` — any remaining reference in store selectors, seed data, or tests

---

## CSS classes to remove

All of the following are defined exclusively for the comments system. Confirmed
present in `app/globals.css`. Remove the full rule block for each.

- `.comments` (line 867) — outer wrapper
- `.comment-composer` (line 872)
- `.comment-composer-body` (line 877)
- `.comment-composer-actions` (line 882)
- `.comment-composer-actions .btn` (line 885)
- `.comment-input`, `.comment-edit-input` (lines 889–902, combined block)
- `.comment-list` (line 907)
- `.comment-row` (line 914)
- `.comment-row > .avatar` (line 920)
- `.comment-content` (line 921)
- `.comment-head` (line 926)
- `.comment-author` (line 932)
- `.comment-time` (line 935)
- `.comment-edited` (line 938)
- `.comment-body` (line 941)
- `.comment-body a` (line 947)
- `.comment-body a:hover` (line 951)
- `.comment-actions` (line 953)
- `.comment-actions .btn` (line 958)
- `.comment-confirm-delete` (line 962)
- `.comment-confirm-delete .btn` (line 968)
- `.comment-kebab` (line 972)
- `.comment-row:hover .comment-kebab`, `.comment-row:focus-within .comment-kebab` (lines 977–978)
- `.comment-kebab-menu` (line 979)
- `.card-comment-indicator` (line 984)
- `.cd-comments` shared rule in the slot-spacing block (line 541 — remove only
  `, .cd-comments` from the comma-separated selector; leave `.cd-description`
  and `.cd-checklist` intact)

No new tokens introduced; no tokens removed (all comment styles used only
existing tokens: `--fg1/2/3/4`, `--surface-02`, `--brand-indigo`, `--border-subtle`).

---

## Kebab utility note

`Comments.tsx` adds a `.comment-kebab` class and a `.comment-kebab-menu` to the
row's own kebab button. The shared utility classes `.kebab-trigger`, `.kebab-menu`,
and `.menu-item` are also used in `Card.tsx`'s card-body kebab — do not remove
those shared classes. Only `.comment-kebab` and `.comment-kebab-menu` (the
comment-specific modifier classes) are removed.

---

## Out of scope

- Any replacement async-discussion mechanism.
- `card.comments` localStorage migration — handled by F-MIGRATE.
- The `comment` icon in `Primitives.tsx` — a separate F-13-RM task; confirm no
  other component references `Icon name="comment"` before removing the icon
  definition. If anything else uses it, leave the icon and only remove the
  call sites in `Card.tsx`.
- Description-icon indicator removal from card preview — that is F-08's concern
  per backlog §F-08 note.
