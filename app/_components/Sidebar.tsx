import { Avatar, Icon } from "./Primitives";

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="workspace">
        <span className="ws-mark">A</span>
        <span className="ws-name">Atlas</span>
        <Icon
          name="chevron"
          size={14}
          style={{ marginLeft: "auto", color: "var(--fg4)" }}
        />
      </div>

      <div className="side-section">
        <button
          className="btn btn-subtle"
          style={{ width: "100%", justifyContent: "flex-start", height: 28 }}
        >
          <Icon name="search" size={13} /> Search
          <span style={{ marginLeft: "auto" }} className="kbd">
            ⌘K
          </span>
        </button>
      </div>

      <div className="side-section">
        <div className="side-head">Workspace</div>
        <div className="side-item">
          <Icon name="inbox" size={15} /> Inbox <span className="count">3</span>
        </div>
        <div className="side-item">
          <Icon name="board" size={15} /> Boards <span className="count">12</span>
        </div>
        <div className="side-item">
          <Icon name="cycle" size={15} /> Cycles <span className="count">2</span>
        </div>
      </div>

      <div className="side-section">
        <div className="side-head">Retros</div>
        <div className="side-item active">
          <span className="swatch" style={{ background: "#5e6ad2" }} /> Sprint 24 — checkout v2{" "}
          <span className="count">12</span>
        </div>
        <div className="side-item">
          <span className="swatch" style={{ background: "#7a7fad" }} /> Sprint 23 — auth migration{" "}
          <span className="count">·</span>
        </div>
        <div className="side-item">
          <span className="swatch" style={{ background: "#3b9ee0" }} /> Sprint 22 — perf push{" "}
          <span className="count">·</span>
        </div>
        <div className="side-item">
          <span className="swatch" style={{ background: "#27a644" }} /> Q1 launch retro{" "}
          <span className="count">·</span>
        </div>
      </div>

      <div
        style={{
          marginTop: "auto",
          padding: 12,
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div className="side-item">
          <Avatar user={{ initials: "YO", color: "#5e6ad2" }} size={20} />
          <span style={{ fontSize: 13 }}>You</span>
          <Icon
            name="settings"
            size={13}
            style={{ marginLeft: "auto", color: "var(--fg4)" }}
          />
        </div>
      </div>
    </aside>
  );
}
