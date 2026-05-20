import type { Metadata } from "next";
import { boardsContainer } from "@/lib/cosmos";
import type { Board } from "@/app/_data/retro";
import { RetroApp } from "../../_components/RetroApp";

// Resolve the page title from the board itself so a board URL pasted into
// Slack/Teams unfurls with that board's name. Without this, every board page
// inherits the layout's generic fallback title.
//
// Cross-partition query (the URL carries `id` only, not `workspaceId`) — the
// same lookup the GET handler in app/api/boards/[id]/route.ts uses. Teams'
// link-preview crawler (`SkypeUriPreview`) is an HTML-limited bot, so Next
// blocks on this and emits the title into `<head>` where the crawler reads it.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const { resources } = await boardsContainer()
      .items.query<Pick<Board, "title" | "theme">>({
        query: "SELECT c.title, c.theme FROM c WHERE c.id = @id",
        parameters: [{ name: "@id", value: id }],
      })
      .fetchAll();
    const board = resources[0];
    if (board?.title) {
      return {
        title: board.title,
        openGraph: {
          title: board.title,
          description: board.theme || "Sprint retrospective board",
          siteName: "Retro Board",
        },
      };
    }
  } catch {
    // Cosmos unreachable — fall back to the layout's default title rather
    // than failing the whole page render over a metadata lookup.
  }
  return {};
}

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RetroApp boardId={id} />;
}
