# F-13 — Card comments

## 1. Feature recap

The card details modal already ships an empty `.cd-comments` slot from F-07 (last block in `.cd-main`). F-13 fills it: a composer at the top, a list below, edit/delete on the user's own comments, and a small comment-count indicator on the card preview. Backlog notes this is single-user for v1 (you comment to yourself), so we lean low-ceremony — no toasts, no loading, no optimistic acks beyond what `localStorage` already gives us.

## 2. Layout (inside `.cd-comments`)

```
[h3] Comments
┌─ .comment-composer ────────────────────────────┐
│  ◉  ┌──────────────────────────────────────┐   │
│     │ Write a comment…                     │   │
│     │                                      │   │
│     └──────────────────────────────────────┘   │
│                                       [ Send ] │
└────────────────────────────────────────────────┘

┌─ .comment-list ────────────────────────────────┐
│ ◉  Maya · 2h ago                          ⋮    │
│    The tax-rounding fix was elegant.           │
│                                                │
│ ◉  You · 5h ago                                │
│    Matches what staging showed.                │
└────────────────────────────────────────────────┘
```

- Composer above list. List ordered **newest-on-top** (matches Trello's modal; recent = most relevant in single-user use).
- Composer avatar = the local "me" user, 22px, top-aligned with the textarea's first line.
- Send button sits below the textarea, right-aligned, on its own row so a long draft doesn't push it off-screen.

## 3. Composer

- Multiline `<textarea class="comment-input">`. Placeholder: `Write a comment…` (with ellipsis char, matching the description placeholder voice).
- Autosizes from 2 rows up to 8, then scrolls (same idiom as `.cd-description-input` autosize).
- Submit shortcuts: **Cmd/Ctrl+Enter** submits; plain `Enter` inserts newline.
- `Send` button (`.btn .btn-primary`, small variant): disabled when trimmed draft is empty. Click submits the same as Cmd/Ctrl+Enter.
- After submit: clear draft, blur stays — facilitates "post several comments in a row." No toast.
- `Esc` while focused inside the textarea: clear draft if non-empty, else propagate (modal closes). Match the inline-edit pattern: stop propagation only when there's something to revert.
- Hidden in read-only (`board.state === "closed"`).

## 4. Comment row

Layout: `[avatar] [head: name · time | kebab] [body]` — avatar in a left rail, head + body stacked in the right rail.

- Avatar: 22px, resolves via `users.find(u => u.id === comment.authorId)`. If unknown (label/user later removed), fall back to the existing "?" anonymous-style avatar.
- Head row (`.comment-head`): name `--fg2 / 13px / 510`, then a `·` separator, then `formatRelativeTime(createdAt)` in `--fg4 / 12px`.
- If `comment.updatedAt` is set, append ` · edited` after the time, in `--fg4 / 11px / italic` — gives the user a hint without being shouty.
- Body (`.comment-body`): `--fg2 / 13px / line-height 1.55 / white-space: pre-wrap`. URLs auto-linked via the same `URL_REGEX` reused from F-08 (small helper in this file, no shared util needed).
- Kebab (`⋮`) shows only on own comments and when not read-only. Same affordance as the card kebab: hover-to-reveal, click-to-open menu, items `Edit` / `Delete`. Reuse `.kebab-trigger` + `.kebab-menu` + `.menu-item` classes; position absolute top-right of the row so it doesn't jostle the head text.

## 5. Edit (own comment)

- `Edit` from kebab swaps the body for a `<textarea class="comment-edit-input">` pre-filled with the current body. Autosizes the same way as the composer.
- Below the textarea: `.comment-actions` row with `Save` (primary, small) and `Cancel` (ghost, small).
- **Save**: trimmed draft non-empty AND ≠ current body → call `editComment`, exit edit. Empty/unchanged → silent revert, exit edit.
- **Cancel** / **Esc**: revert local draft, exit edit. Esc stops propagation so the modal stays open.
- **Cmd/Ctrl+Enter**: same as Save.
- The kebab affordance hides while editing (replaced by the action buttons); this matches `Card.tsx`'s "kebab hidden while editing" rule.

## 6. Delete (own comment)

- `Delete` from kebab opens an **inline** confirm in place of the kebab menu — no full-screen modal. The comment row sprouts a one-line `.comment-confirm-delete`: muted text `Delete this comment?` and two compact buttons `Yes` (danger) / `Cancel` (ghost).
- Confirm `Yes` → `deleteComment`. The row then animates out via the same 180ms collapse used for cards (inherits when F-21 lands; for v1 the row just unmounts).
- `Esc` while the inline confirm is showing dismisses the confirm, not the modal.

## 7. Card preview indicator

- New `.card-comment-indicator` inside `.vote-row`, placed **after** `.card-checklist-indicator` and `.card-desc-indicator`, **before** `.voters`. Renders only when `(card.comments?.length ?? 0) > 0`.
- Visual: comment-bubble icon + count, `--fg4 / 10px / mono`, same typographic system as the checklist indicator.
- Add a `comment` icon to `Primitives.tsx` (speech bubble outline; matches the existing 24-viewbox 1.5-stroke style).
- `aria-label` and `title`: `"N comments"` (or `"1 comment"` for one).

## 8. Read-only board (`closed`)

- Composer hidden entirely (don't render it disabled — saves ~80px of vertical space).
- Comment rows render normally, body included.
- Kebab hidden on all rows. Existing comments are pure read.

## 9. Empty state

- No composer hint copy — placeholder already invites input. When list is empty and composer present, the section feels naturally inviting; no separate empty string needed.
- When read-only AND list is empty: render a muted `.cd-placeholder` `No comments.` so the section isn't a bare heading.

## 10. CSS classes (all new, all justified)

- `.comments` — wrapper inside `.cd-comments`; flex column, gap 14px between composer and list.
- `.comment-composer` — flex row, gap 8px; avatar left, content stack right.
- `.comment-input` — textarea reuses `.cd-description-input` look (same token set) but with `min-height: 60px` and own class so future tweaks don't churn description.
- `.comment-composer-actions` — right-aligned row holding Send.
- `.comment-list` — flex column, gap 12px.
- `.comment-row` — relative; flex row; gap 8px; padding 4px on top/bottom so kebab hover area is generous.
- `.comment-head` — flex row, gap 6px, baseline align.
- `.comment-author` — `--fg2 / 13px / 510`.
- `.comment-time` — `--fg4 / 12px`.
- `.comment-time.edited` — adds the ` · edited` italic suffix tone.
- `.comment-body` — pre-wrap, `--fg2 / 13px / 1.55`.
- `.comment-edit-input` — same look as `.comment-input`.
- `.comment-actions` — flex row, gap 6px, justify-end, margin-top 6px.
- `.comment-confirm-delete` — flex row, gap 8px, font 12px `--fg3`, padding-top 4px.
- `.card-comment-indicator` — mirrors `.card-checklist-indicator` (icon + small count).

No new color tokens; everything reuses `--fg1/2/3/4`, `--surface-02`, `--brand-indigo`, `--border-subtle`. New icon: `comment` in `Primitives.tsx`.

## 11. Animations

- Inherit modal-level transitions. Comment row insert: no explicit pulse in v1 (newest-on-top makes it visually obvious without animation). Delete row: rely on F-21's collapse pass; for now, immediate unmount.
- `prefers-reduced-motion`: nothing to disable beyond what F-21 already covers.

## 12. Edge cases

- **Author has been removed** (e.g. `me` becomes someone else later, or a seed user dropped): show `?` avatar and the bare `authorId` as name. Do not crash; do not hide the comment.
- **Very long single line / URL** in body: `word-break: break-word` on `.comment-body` so it wraps.
- **Many comments** (100+): list is inside the modal's already-scrollable `.cd-grid`; no virtualization in v1.
- **Two edits in flight**: single-user, single tab — not a real concern. If `comment.updatedAt < other.updatedAt` ever needs reconciliation that's a v2/backend story.
- **Rapid post**: ids generated from `Date.now()` collide if user pastes-and-cmd-enters in <1ms — mitigate the same way the rest of the store does (`"cmt-" + Date.now().toString(36) + "-" + random`).

## 13. Microcopy

- Placeholder: `Write a comment…`
- Send button: `Send`
- Edit menu: `Edit`
- Delete menu: `Delete`
- Edit actions: `Save`, `Cancel`
- Delete confirm: `Delete this comment?`, `Yes`, `Cancel`
- Edited badge: `edited`
- Read-only empty: `No comments.`
- Card indicator title: `N comments` / `1 comment`

All lowercase except "Yes/Cancel/Save/Send/Edit/Delete" verbs (matches existing button casing).

## 14. Open questions for PO

None. Newest-on-top recommended; PO can flag if they prefer oldest-on-top later.
