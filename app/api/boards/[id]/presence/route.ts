import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { snapshot, touch } from "@/lib/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  // Also touch on presence read so a user who just opened the board appears
  // in their own first poll, without waiting for the 1.5s board GET to land.
  if (session.user.id && session.user.name) {
    touch(id, session.user.id, session.user.name);
  }

  return Response.json(snapshot(id));
}
