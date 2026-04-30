// F-20: pure markdown formatters for retro exports.
//
// Two outputs:
//   - exportActionItems(board): the rightmost column as a flat bullet list,
//     one card per line with `(votes: N)`. Used by "Copy action items".
//   - exportRetroSummary(board): the whole board grouped by column, with
//     the board title as the H1 and each column as an H2. Used by
//     "Copy full retro summary".
//
// Author names are deliberately omitted regardless of anonymous mode — see
// design-F-20.md §4. Archived cards are skipped (live columns only).

import type { Board, Card } from "../_data/retro";

// Cards are stored without an `archivedAt` slot when live. F-14 sets it on
// archive and moves the card into `board.archivedCards`, so a defensive
// filter here is cheap insurance against any future code path that leaves
// an archived card inside `column.cards`.
function isLive(card: Card): boolean {
  return !card.archivedAt;
}

// Collapse internal whitespace so each card renders as one bullet — multi-line
// bodies otherwise split into two list items in most markdown renderers.
function oneLine(body: string): string {
  return body.replace(/\s+/g, " ").trim();
}

function bullet(card: Card): string {
  return `- ${oneLine(card.body)} (votes: ${card.voters.length})`;
}

export function exportActionItems(board: Board): string {
  const cols = board.columns;
  if (cols.length === 0) return "_No action items._";
  const rightmost = cols[cols.length - 1];
  const live = rightmost.cards.filter(isLive).filter((c) => oneLine(c.body));
  if (live.length === 0) return "_No action items._";
  return live.map(bullet).join("\n");
}

export function exportRetroSummary(board: Board): string {
  const lines: string[] = [];
  lines.push(`# ${board.title}`);
  for (const col of board.columns) {
    lines.push("");
    lines.push(`## ${col.title}`);
    const live = col.cards.filter(isLive).filter((c) => oneLine(c.body));
    if (live.length === 0) {
      lines.push("_No items._");
    } else {
      for (const card of live) lines.push(bullet(card));
    }
  }
  return lines.join("\n");
}
