import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  MIN_REVEAL_VOTES,
  isEnergyLevel,
  reveal,
  snapshot,
  touchRoster,
  vote,
} from "@/lib/energyCheckin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Separate from the board document on purpose: GET /api/boards/[id] ships the
// whole board to every client, so anything stored there is readable in
// DevTools no matter what the UI renders. This endpoint returns aggregates
// only, and nothing but counts until the facilitator reveals.

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  touchRoster(id, session.user.id);
  return Response.json(snapshot(id, session.user.id));
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await req.json()) as {
    level?: unknown;
    action?: unknown;
    force?: unknown;
  };

  if (body.action === "reveal") {
    const outcome = reveal(id, body.force === true);
    if (outcome === "too-few") {
      return Response.json(
        { error: `At least ${MIN_REVEAL_VOTES} votes are needed to reveal` },
        { status: 422 },
      );
    }
    if (outcome === "incomplete") {
      return Response.json(
        { error: "Not everyone has voted yet" },
        { status: 422 },
      );
    }
    return Response.json(snapshot(id, session.user.id));
  }

  if (!isEnergyLevel(body.level)) {
    return Response.json(
      { error: "level must be an integer from 1 to 5" },
      { status: 400 },
    );
  }

  if (!vote(id, session.user.id, body.level)) {
    return Response.json(
      { error: "Results are already revealed" },
      { status: 409 },
    );
  }

  return Response.json(snapshot(id, session.user.id));
}
