# Retro Board — 인수인계 문서

> 작성일: 2026-04-29
> 디자인 번들: `https://api.anthropic.com/v1/design/h/eMuU_em5vNo6C-XWJV2RBA` (Claude Design 핸드오프, 2026-04-26 작성)

---

## 1. 프로젝트 개요

- **위치:** `/Users/jryu/Projects/retro-board`
- **스택:** Next.js **16.2.4**, React **19.2.4**, Tailwind **v4**, TypeScript, bun
- **구조:** App Router, `_components/` (Card, Column, Primitives, RetroApp, Sidebar), `_data/retro.ts`
- **현재 브랜치 상태:** `main` 클린, 커밋 2개 (`Implement board with design system`이 최신)

> ⚠️ **AGENTS.md 주의사항**: Next.js 16은 학습 데이터의 API/컨벤션과 다를 수 있는 브레이킹 체인지가 많음. 코드 작성 전 `node_modules/next/dist/docs/`의 관련 가이드를 먼저 읽을 것.

---

## 2. 디자인 번들 구성

| 파일                                                                      | 역할                                                                    |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `README.md`                                                               | 핸드오프 안내 ("chat 먼저, 그다음 `Retro Board.html`")                  |
| `chats/chat1.md`                                                          | 단일 대화 transcript (2026-04-26)                                       |
| `project/Retro Board.html`                                                | **메인 hi-fi 디자인** (사용자가 마지막에 열고 있던 파일)                |
| `project/Retro Board Wireframes.html`                                     | 초기 3-탭 와이어프레임 (board / card affordances / discussion variants) |
| `project/retro-app.jsx`, `retro-board.jsx`, `retro-data.jsx`, `retro.css` | hi-fi 소스                                                              |
| `project/app.jsx`, `board.jsx`, `data.jsx`, `tweaks-panel.jsx`            | wireframe 소스                                                          |
| `project/ds/Primitives.jsx`, `_app.css`, `colors_and_type.css`            | 공유 디자인 시스템                                                      |

### 디자인 의도 (chat 기준)

1. **Iteration 1 (wireframe):** sketchy B&W + indigo accent, 3 탭. 결정사항: kebab 카드 affordance, 다크/Linear hi-fi로 진행.
2. **Iteration 2 (hi-fi):** "BW Trello" 다크 + Linear 무드 + indigo accent → `Retro Board.html`. **스코프: 보드 상세 페이지만.**

---

## 3. 구현 현황 — 무엇이 코드에 들어와 있는가

현재 Next.js 16 / React 19 / TS 코드는 **hi-fi `Retro Board.html`을 거의 1:1로 포팅한 상태**.

| 디자인 소스                                            | 포팅된 위치                                   |
| ------------------------------------------------------ | --------------------------------------------- |
| `retro-app.jsx` (App + Sidebar)                        | `app/_components/RetroApp.tsx`, `Sidebar.tsx` |
| `retro-board.jsx` (HiColumn + Card)                    | `app/_components/Column.tsx`, `Card.tsx`      |
| `ds/Primitives.jsx` (Avatar, Icon)                     | `app/_components/Primitives.tsx`              |
| `retro-data.jsx`                                       | `app/_data/retro.ts` (TS 타입 추가)           |
| `retro.css` + `ds/_app.css` + `ds/colors_and_type.css` | `app/globals.css` (병합)                      |

### ✅ 동작하는 기능

- Sidebar (workspace, search, Inbox/Boards/Cycles, Retros 리스트, user)
- Top bar: 인라인 편집 가능한 타이틀, open/closed 상태 pill, presence stack (5 + "+2"), Anonymous 토글, Start discussion, Close board
- Collapsible theme banner
- 4개 컬럼 + collapsible description + "Add a card" (Enter 저장, Esc 취소)
- 카드: body, author + avatar, voter avatar stack, indigo 채움 vote pill, "new card" highlight
- 본인 카드: kebab → edit (인라인 textarea) / delete
- Discussion mode: focus halo, 나머지 dim, top-voted flag, votes desc 정렬, progress pips, ←/→/Esc 키보드 nav, prev/next/finish
- Anonymous mode: sticky banner + toast + voter avatar 마스킹 ("?")
- Close board: confirm modal → read-only 전환
- Auto-dismiss toast

### TS 포팅 시 추가된 점

- User/RetroCard/Column/Board 및 모든 컴포넌트 props 타입 정의
- 이벤트 핸들러에 `useCallback` 적용
- `anonInitialized` ref로 anon 토글의 mount 시점 toast 억제 (JSX 버전은 mount 시 toast가 발생함)

---

## 4. 보드 동작 스펙 (디자인 의도 정리)

> 출처: `Retro Board Wireframes.html`의 `app.jsx` 안 frame caption + States covered 노트, 그리고 `chats/chat1.md`

### 4.1 권한 / 편집 모델

- **타이틀 + 테마**: 누구나 편집 가능
- **컬럼 이름·삭제, 보드 닫기**: **owner 전용** (5–10명 retro에서 타이틀까지 ownership으로 막으면 마찰만 늘린다는 명시적 결정)
- **카드 편집/삭제**: 본인 카드만 (kebab 메뉴 — hover/always-visible 중에서 **kebab을 권장 default로 채택**)
- **인라인 타이틀 편집**: hover 시 흐린 연필 아이콘 → 클릭하면 input으로 swap → **Esc 취소, Enter 저장, blur 저장**

### 4.2 핵심 인터랙션

- **Add card**: 컬럼 상단에 항상 노출 (silent brainstorm 시 가장 빈번한 액션이라 1순위)
- **Vote toggle**: indigo로 채워진 버튼 + voter avatar 슬라이드 인. tooltip: _"Click to remove your vote."_
- **Anonymous toggle**: pill 형태 토글 + 켜고 끌 때마다 toast
- **Discussion mode 진입**: facilitator가 "Start discussion" 클릭 → 첫 컬럼 focus → theme bar 자동 collapse

### 4.3 Discussion mode 동작 룰

- **카드 정렬**: 항상 **votes desc** ("팀이 가장 많이 동의한 것부터 논의")
  - facilitator override(드래그, "discuss in order added")는 향후 추가
- **Variant A (dim & outline)**: focused 컬럼은 강한 outline, 나머지는 흐려짐 — calmer, 컨텍스트 유지 _(채택됨)_
- **Variant B (spotlight)**: focused 컬럼이 scale up + indigo halo, top-voted 카드에 ★ flag — TV 프로젝션 시 적합 _(미채택, wireframe만)_
- **late additions 허용**: focus 안 된 컬럼에서도 add card / vote 그대로 동작 (논의 중 새 카드 자주 생김)
- **핸드오프**: "Next column →" 라벨 (구두 hand-off "이 컬럼 너가, 다음 건 내가"에 매칭) → 마지막 컬럼은 "Finish discussion"
- **Keyboard**: ←/→ 이동, Esc 종료

### 4.4 실시간 동작 (Realtime behavior — 노트 기반, 시각화는 안 됨)

- **다른 유저가 새 카드 추가** → 240ms fade-in + 1-pulse indigo border → settle
- **카드 편집** → body cross-fade. 화면 밖이면 애니메이션 없음
- **카드 삭제** → height + opacity 180ms 동안 collapse. 그 카드에 voting 중이었다면 클릭은 toast로 흡수: _"That card was just deleted."_
- **투표 add/remove** → 카운터 tick + voter avatar가 오른쪽에서 슬라이드
- **컬럼 add/rename/delete** → owner only. 비어있지 않은 컬럼 삭제는 confirm
- **Presence** → header 아바타 in/out 애니메이션. hover tooltip: name + "joined 2 min ago"

### 4.5 연결 / 닫힘 상태

- **Lost connection**: _"Reconnecting… your changes will sync when you're back."_
- **Close board**: confirm modal → 보드는 read-only지만 카드는 readable. "Closed · read-only" 뱃지 노출. boards list에서 reopen 가능 _(단, boards list 자체는 미구현)_

### 4.6 Microcopy bank (그대로 사용 가능)

| 상황                              | 카피                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------- |
| 빈 보드                           | "No cards yet. Be the first — what's on your mind?"                             |
| 빈 컬럼                           | "Nothing here yet."                                                             |
| 카드 삭제 confirm                 | "Delete this card? Everyone in the room will see it disappear."                 |
| 컬럼 삭제 confirm (비어있지 않음) | "This column has 4 cards. Delete the column and all its cards?"                 |
| 보드 닫기 confirm                 | "Close this retro? Cards stay readable. Voting and editing will be turned off." |
| Anon ON 배너                      | "Anonymous mode — authors are hidden for everyone."                             |
| 닫힌 보드 뱃지                    | "Closed · read-only"                                                            |
| 투표한 상태 tooltip               | "Click to remove your vote."                                                    |

---

## 5. 구현되지 않은 것 / Backlog

### 디자인 자체에서 의도적으로 제외된 것 (스코프 외)

- **Boards list 페이지**
- **Create-board 다이얼로그**
- **Discussion mode Variant B (spotlight)** — Variant A만 채택
- 위 셋은 wireframe-only 상태로 남음. chat에서 "next steps if you want them"으로 명시.

### 스펙엔 있으나 코드엔 없는 것 (실제 backlog)

- ❌ **Realtime fade-in / cross-fade / collapse 애니메이션** (모든 mutation이 즉시 반영 — 단일 유저 in-memory state라 백엔드 붙기 전엔 의미 없음)
- ❌ **Lost connection 배너**
- ❌ **빈 보드 / 빈 컬럼 empty state 카피**
- ❌ **컬럼 삭제 confirm** (애초에 컬럼 삭제 UI 자체가 없음 — column header의 kebab은 placeholder)
- ❌ **컬럼 추가 후 rename**
- ❌ **Presence tooltip** ("joined 2 min ago")
- ❌ **Title 편집 시 hover pencil hint** (현재는 input이 항상 보임 — hi-fi 프로토타입도 이미 단순화됨, 의도적일 수 있음)
- ❌ **"yours" 뱃지** (wireframe엔 있었으나 hi-fi에서 제거됨 — 의도된 것으로 보임)

### 인프라 레벨에서 미구현

- 모든 state는 in-memory React `useState`. 영속성/실시간/인증 없음 (프로토타입과 동일)
- Presence "+2"는 하드코딩 (`USERS.length - 5`로 derive 안 함)
- "me" 유저는 ownership/vote-self 판정용 데모 ID

---

## 6. 다음 사람을 위한 메모

1. **디자인 번들은 `/tmp/retro-design/retro-board/`에 압축 해제됨** — 세션 종료 시 사라질 수 있으니 필요 시 `https://api.anthropic.com/v1/design/h/eMuU_em5vNo6C-XWJV2RBA?open_file=Retro+Board.html`에서 다시 받을 것.
2. **CSS는 `app/globals.css`에 모두 병합됨** — wireframe과 hi-fi의 두 개 디자인 시스템 중 hi-fi(BW Trello 다크 + indigo)만 살아있음.
3. **데이터 모델은 `app/_data/retro.ts`에 시드** — 백엔드 붙일 때 이 타입을 그대로 시작점으로 쓸 수 있음.
4. **AGENTS.md의 Next.js 16 경고 무시 금지** — 특히 Server Component / Client Component 경계, App Router의 새 규약 변경 가능성에 유의.
