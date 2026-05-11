import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { boardsContainer, stripSystemFields } from "@/lib/cosmos";
import type { Board } from "@/app/_data/retro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return Response.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const { resources } = await boardsContainer()
    .items.query<Board & Record<string, unknown>>(
      {
        query: "SELECT * FROM c WHERE c.workspaceId = @ws",
        parameters: [{ name: "@ws", value: workspaceId }],
      },
      { partitionKey: workspaceId },
    )
    .fetchAll();

  return Response.json(resources.map(stripSystemFields));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Partial<Board>;
  if (!body.id || !body.workspaceId) {
    return Response.json(
      { error: "id and workspaceId are required" },
      { status: 400 },
    );
  }

  const { resource } = await boardsContainer().items.create<Board>(body as Board);
  if (!resource) {
    return Response.json({ error: "Create failed" }, { status: 500 });
  }
  return Response.json(stripSystemFields(resource), { status: 201 });
}
