# F-20 — Action items export (retro-only)

## 1. Feature recap

Retros generate the right takeaways and then lose them: the board closes, the tab gets buried, and the next sprint nobody remembers what we said. F-20 adds two clipboard exports to the retro board's settings menu so a facilitator can paste the outcome into Slack, a doc, or a ticket the moment the meeting ends. No file download, no integrations — clipboard plus a toast is the whole feature.

## 2. Surface

The two items live inside the existing `BoardSettingsMenu` (F-17), the kebab popover at the right end of the topbar action cluster. The menu already groups "view actions" above the divider and "state-changing actions" below it; the exports slot in alongside `Archived items` as additional view actions.

```
Edit theme prompt
Manage labels
Copy action items          ← F-20, retro only
Copy full retro summary    ← F-20, retro only
Archived items (N)
─────────────
Archive board / Reopen / Unarchive
```

Both items are **retro-only** — gated on `board.type === "retro"`. They are visible on closed and archived boards too: read-only doesn't prevent reading, and exporting a closed retro is the single most common reason this feature exists.

## 3. Format

### Action items
Markdown bulleted list of the cards in the **rightmost column** (whatever it's named — `Try next time`, `Action items`, etc.), one bullet per card, with a trailing `(votes: N)` annotation. Skip archived cards. Skip empty bodies.

```
- Block 2-hour focus windows on the calendar before sprint planning. (votes: 4)
- Add a smoke-test step to the deploy that hits real staging data. (votes: 3)
- Rotate who runs standup — fresh eyes on the blockers. (votes: 1)
```

If the rightmost column is empty: copy a single line `_No action items._` (italic placeholder reads cleanly when pasted into Slack/Notion). Toast still confirms.

### Full retro summary
Markdown grouped by column. Each column title becomes an `## H2`; each card a `- bullet (votes: N)`. Columns appear in left-to-right order. Empty columns render their heading followed by `_No items._`. Board title becomes the `# H1` so the paste lands self-titled.

```
# Sprint 24 — checkout v2

## What went well
- Shipping behind a flag let us catch the tax-rounding bug before any customer hit it. (votes: 5)
- ...

## What didn't
- Staging data drifted from prod — three bugs only showed up after the cutover. (votes: 6)

## Try next time
- Block 2-hour focus windows on the calendar before sprint planning. (votes: 4)
```

## 4. Anonymous mode

**Recommendation: never include author names**, anonymous mode on or off. The export is the *action* and the *priority*; attaching `— Maya` to a bullet is exactly the kind of attribution retro psychological-safety conventions exist to avoid. Anyone who wants attribution back can paste the bullet and tag a name themselves. This also keeps the two formats deterministic (no behavioral fork on a board-level toggle) and dodges the "exported then mode flipped" footgun.

## 5. Toasts

Uses the global toast system (F-22 / `fireToast`). No `Undo` — these actions don't mutate state.

- Success (action items): `Action items copied.`
- Success (full summary): `Retro summary copied.`
- Failure (clipboard rejected — permission denied, insecure context, browser refusal): `Couldn't copy. Try again?`

The failure copy ends in a question to soften the dead-end and matches the existing voice (terse, lowercase pill labels, no exclamation marks).

## 6. Interaction

- Click menu item → menu closes (existing `click(fn)` helper in `BoardSettingsMenu` that `requestAnimationFrame`s the action) → `navigator.clipboard.writeText(markdown)` runs.
- `try/catch`: success branch fires the success toast; rejection / `clipboard` undefined branch fires the failure toast. No second-attempt fallback (e.g. legacy `document.execCommand("copy")`) — modern browsers all support the async clipboard API in secure contexts; a hard fail surfaces the real problem to the user.
- Keyboard: Enter / Space on the focused menu item activates, same as every other menu item.

## 7. Edge cases

- **Zero columns**: Action items fires `_No action items._`; full summary just outputs the board title heading. Both still copy and confirm — empty input shouldn't produce a silent no-op.
- **Board with one column**: The "rightmost column" is also the only column. The export is the whole board. Acceptable.
- **Card body has a literal `(votes: N)` suffix** that the user typed: we don't strip; the resulting paste reads `... (votes: 0) (votes: 0)`. Cosmetic; not worth a regex.
- **Multi-line card body**: collapse internal newlines to spaces inside the bullet so each card stays one line and Markdown renderers don't accidentally split it. Trim the result.
- **Archived cards**: skipped. Live cards only.

## 8. CSS

No new classes. Reuses `.menu-item` (no danger styling — these are neutral actions).

## 9. Open questions for PO

None blocking — anonymous-mode behavior and the closed/archived availability are decided in this spec.
