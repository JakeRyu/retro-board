/**
 * One-shot dev seed: upserts SEED_BOARDS into the local Cosmos Emulator.
 * Run via `npm run seed` (which threads `--env-file=.env.local` through tsx).
 */
import { SEED_BOARDS } from "../app/_data/retro";
import { boardsContainer } from "../lib/cosmos";

async function main() {
  const container = boardsContainer();
  for (const board of SEED_BOARDS) {
    await container.items.upsert(board);
    console.log(`upserted ${board.id}  (workspace=${board.workspaceId})`);
  }
  console.log(`\nDone. ${SEED_BOARDS.length} boards seeded.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
