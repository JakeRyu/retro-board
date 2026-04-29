import Link from "next/link";
import { SEED_BOARD } from "./_data/retro";

// Placeholder home — F-02 replaces this with the boards list.
export default function Home() {
  return (
    <div className="app">
      <div className="main">
        <div className="board-empty">
          <div className="modal">
            <h2>Boards list coming in F-02.</h2>
            <p>For now, jump straight to the seed board.</p>
            <div className="modal-actions">
              <Link href={`/boards/${SEED_BOARD.id}`} className="btn btn-primary">
                Open seed board
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
