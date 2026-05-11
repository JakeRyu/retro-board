import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { boardsContainer, stripSystemFields } from "@/lib/cosmos";
import type { Board } from "@/app/_data/retro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  // Cross-partition lookup: the URL carries id only, and the prototype runs
  // with single-digit boards per workspace, so the RU cost is negligible.
  // F-26-C may revisit if we need point-read efficiency.
  const { resources } = await boardsContainer()
    .items.query<Board & { _etag?: string }>({
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: id }],
    })
    .fetchAll();

  const board = resources[0];
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
