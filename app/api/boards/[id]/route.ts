import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { boardsContainer, stripSystemFields } from "@/lib/cosmos";
import { touch as touchPresence } from "@/lib/presence";
import type { Board } from "@/app/_data/retro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cross-partition lookup helper. Cosmos point-read requires (id, pk); when
// the URL carries id only, we resolve workspaceId via this query. Prototype
// has single-digit boards per workspace so the RU cost is negligible.
async function findBoardById(
  id: string,
): Promise<(Board & { _etag?: string }) | undefined> {
  const { resources } = await boardsContainer()
    .items.query<Board & { _etag?: string }>({
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: id }],
    })
    .fetchAll();
  return resources[0];
}

type CosmosError = { code?: number | string; statusCode?: number };

function isPreconditionFailed(err: unknown): boolean {
  const e = err as CosmosError;
  return e?.code === 412 || e?.statusCode === 412;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  // Heartbeat: every poll of the active board doubles as a presence ping.
  // Lives in the GET handler (before the 304 short-circuit) so a board
  // whose state hasn't changed still keeps the viewer in the active set.
  if (session.user.id && session.user.name) {
    touchPresence(id, session.user.id, session.user.name);
  }

  const board = await findBoardById(id);
  if (!board) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const etag = board._etag;
  const ifNoneMatch = req.headers.get("if-none-match");
  if (etag && ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, { status: 304 });
  }

  const headers: Record<string, string> = {};
  if (etag) headers["ETag"] = etag;
  return Response.json(stripSystemFields(board), { headers });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await req.json()) as Partial<Board>;
  if (!body.id || !body.workspaceId) {
    return Response.json(
      { error: "id and workspaceId are required" },
      { status: 400 },
    );
  }
  if (body.id !== id) {
    return Response.json(
      { error: "URL id does not match body id" },
      { status: 400 },
    );
  }

  const ifMatch = req.headers.get("if-match");
  if (!ifMatch) {
    return Response.json(
      { error: "If-Match header is required" },
      { status: 428 },
    );
  }

  try {
    const { resource } = await boardsContainer()
      .item(id, body.workspaceId)
      .replace<Board>(body as Board, {
        accessCondition: { type: "IfMatch", condition: ifMatch },
      });
    if (!resource) {
      return Response.json({ error: "Replace failed" }, { status: 500 });
    }
    const out = stripSystemFields(resource);
    const headers: Record<string, string> = {};
    if (out.etag) headers["ETag"] = out.etag;
    return Response.json(out, { headers });
  } catch (err) {
    if (isPreconditionFailed(err)) {
      return Response.json(
        { error: "ETag mismatch — refetch and retry" },
        { status: 412 },
      );
    }
    throw err;
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const board = await findBoardById(id);
  if (!board) {
    // Idempotent: already gone is still "deleted".
    return new Response(null, { status: 204 });
  }

  await boardsContainer().item(id, board.workspaceId).delete();
  return new Response(null, { status: 204 });
}
