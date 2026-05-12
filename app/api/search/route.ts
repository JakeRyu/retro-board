import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { boardsContainer } from "@/lib/cosmos";
import type { Board, Card } from "@/app/_data/retro";
import type { SearchHit } from "@/app/_data/searchTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_QUERY_LEN = 2;
const MAX_RESULTS = 50;
const SNIPPET_WINDOW = 60;

function makeSnippet(text: string, matchIdx: number, qLen: number) {
  const start = Math.max(0, matchIdx - SNIPPET_WINDOW);
  const end = Math.min(text.length, matchIdx + qLen + SNIPPET_WINDOW);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  const slice = text.slice(start, end);
  return {
    snippet: prefix + slice + suffix,
    matchStart: prefix.length + (matchIdx - start),
    matchLen: qLen,
  };
}

function searchCard(card: Card, q: string): { snippet: string; matchStart: number; matchLen: number } | null {
  const haystack = (card.body || "") + (card.description ? "\n" + card.description : "");
  const idx = haystack.toLowerCase().indexOf(q);
  if (idx < 0) return null;
  return makeSnippet(haystack, idx, q.length);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  const rawQ = req.nextUrl.searchParams.get("q") ?? "";
  const q = rawQ.trim().toLowerCase();
  if (!workspaceId) {
    return Response.json({ error: "workspaceId is required" }, { status: 400 });
  }
  if (q.length < MIN_QUERY_LEN) {
    return Response.json([] satisfies SearchHit[]);
  }

  const { resources } = await boardsContainer()
    .items.query<Board>(
      {
        query: "SELECT * FROM c WHERE c.workspaceId = @ws",
        parameters: [{ name: "@ws", value: workspaceId }],
      },
      { partitionKey: workspaceId },
    )
    .fetchAll();

  const hits: SearchHit[] = [];

  for (const board of resources) {
    if (hits.length >= MAX_RESULTS) break;
    const archived = Boolean(board.archivedAt);

    if (board.title.toLowerCase().includes(q)) {
      hits.push({
        kind: "board",
        boardId: board.id,
        boardTitle: board.title,
        archived,
      });
    }

    for (const col of board.columns) {
      for (const card of col.cards) {
        if (hits.length >= MAX_RESULTS) break;
        const match = searchCard(card, q);
        if (!match) continue;
        hits.push({
          kind: "card",
          boardId: board.id,
          boardTitle: board.title,
          archived,
          cardId: card.id,
          cardArchived: false,
          ...match,
        });
      }
      if (hits.length >= MAX_RESULTS) break;
    }

    for (const card of board.archivedCards) {
      if (hits.length >= MAX_RESULTS) break;
      const match = searchCard(card, q);
      if (!match) continue;
      hits.push({
        kind: "card",
        boardId: board.id,
        boardTitle: board.title,
        archived,
        cardId: card.id,
        cardArchived: true,
        ...match,
      });
    }
  }

  return Response.json(hits);
}
