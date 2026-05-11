import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { userStateContainer } from "@/lib/cosmos";
import { WORKSPACES } from "@/app/_data/retro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Single doc per user. Schema kept tiny on purpose — anything that doesn't
// need cross-device sync (collapsed state, dismissed toasts) stays in local
// browser state, not here.
type UserStateDoc = {
  id: "user-state";
  userId: string;
  activeWorkspaceId: string | null;
};

type CosmosError = { code?: number | string; statusCode?: number };
function isNotFound(err: unknown): boolean {
  const e = err as CosmosError;
  return e?.code === 404 || e?.statusCode === 404;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let doc: UserStateDoc | undefined;
  try {
    const { resource } = await userStateContainer()
      .item("user-state", userId)
      .read<UserStateDoc>();
    doc = resource;
  } catch (err) {
    if (!isNotFound(err)) throw err;
  }

  return Response.json({
    activeWorkspaceId: doc?.activeWorkspaceId ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json()) as { activeWorkspaceId?: unknown };
  const next = body.activeWorkspaceId;
  if (typeof next !== "string" || !WORKSPACES.some((w) => w.id === next)) {
    return Response.json(
      { error: "activeWorkspaceId must be a known workspace id" },
      { status: 400 },
    );
  }

  const doc: UserStateDoc = {
    id: "user-state",
    userId,
    activeWorkspaceId: next,
  };
  await userStateContainer().items.upsert<UserStateDoc>(doc);
  return Response.json({ activeWorkspaceId: next });
}
