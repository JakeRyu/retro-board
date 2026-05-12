// Shape returned by GET /api/search. Hoisted to a separate module so client
// components don't have to import from a route handler file (which would
// pull the route's server-only deps — Cosmos client, auth — into the
// client's type-resolution graph).

export type SearchHit =
  | {
      kind: "board";
      boardId: string;
      boardTitle: string;
      archived: boolean;
    }
  | {
      kind: "card";
      boardId: string;
      boardTitle: string;
      archived: boolean;
      cardId: string;
      cardArchived: boolean;
      snippet: string;
      matchStart: number;
      matchLen: number;
    };
