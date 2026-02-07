# RPS Stratego / "אחסן, נייר ומספריים" – Current Status

> **Purpose:** This document provides context for the next AI session. Read it first to understand where we left off.

---

## 1. Recent Accomplishments

### Welcome Screen, Auth & PWA Readiness

- Glassmorphism `WelcomeScreen` replaces the old Lobby login, fully RTL for Hebrew.
- Animated gradient background + subtle grid overlay, Orbitron title.
- Primary title updated to **"אחסן, נייר ומספריים"**, secondary line **"STRATEGO BATTLE"**.
- **Real authentication flow:**
  - Login / Register toggle with username + password and Israeli Premier League **team selection**.
  - Teams (`Group` records) pulled from `/auth/groups`, each with a branded hex color.
  - Successful auth shows a **"מחובר כ־ ..."** banner with team name & color, hides the auth form, and focuses UX on Room ID + Join Game.
- **JWT‑based backend auth:**
  - `POST /auth/register` & `POST /auth/login` implemented with Prisma + Postgres.
  - Passwords stored as **bcrypt hashes** (not reversible); user + team returned with a signed JWT.
  - JWT is saved to `localStorage` and hydrated into `GameContext` as `authUser`/`authToken`.
- **Socket.IO security:**
  - Client opens the Socket.IO connection with `auth: { token }`.
  - Server adds a Socket.IO middleware that verifies the JWT (`jwt.verify` with `JWT_SECRET`), loads the user + group from Prisma, and attaches `socket.user`.
  - `join_room` now **ignores client‑supplied names** and always uses `socket.user` (id, username, team name/color), preventing spoofing.
- **Basic PWA wiring still in place:**
  - `manifest.webmanifest` with Hebrew app name, icons, theme/background colors.
  - Minimal `sw.js` and registration in `main.jsx` so the app is installable (Android + desktop).
  - iOS meta tags (`apple-mobile-web-app-*`) configured.

> ⚠️ On iOS PWA (installed to home screen), the system keyboard still does **not** appear reliably on the WelcomeScreen inputs. See "Known Bugs & UX Gaps".

### Board Orientation & Layout

- Local player always sees their pieces at the bottom.
- **Player 2 (top side):** board container uses `transform: rotate(180deg)` so their pieces appear at the bottom.
- Each grid cell is counter‑rotated so units stay upright.
- **Red / Player 2 upside‑down bug fixed:** removed extra `rotate(180deg)` from enemy units in `Board.jsx`; both players now see the opponent upright.
- Board tiles now use a stable layout (`aspect-square` on the outer wrapper, `w-full h-full` on the inner tile) so cells remain square and consistent on mobile, even with rings/hover/animations.
- Pieces now glow in **team colors**: my pieces use my team color, opponent pieces use theirs.

### In‑Game HUD & Feedback

- Old top/bottom `PlayerBanner` replaced with a single `GameHUD` across the top:
  - Layout: `[Player 1] — [Timer/Status] — [Player 2]`.
  - Active player gets green glow and scale‑up; waiting player is dimmed.
  - HUD now shows **team name + colored indicator** per player, using real team colors from the authenticated `Group`.

### Battle, Tie UX & Match Presentation

- **Battle location indicator:** Only the **target battle cell** now gets a pulsing red ring (`ring-4 ring-red-600 animate-pulse`), with a short pre‑battle delay (~900ms) so players clearly see where the combat is happening before the modal appears.
- **Draw feedback on board:** The draw square shows a 🤝 "DRAW" overlay plus grey/silver pulse when `result === 'both_destroyed'`.
- **Combat modal enhancements:**
  - Shows both attacker and defender icons (Rock/Paper/Scissors/Trap) with clear labels: **"Your unit"** vs **"Opponent"**.
  - Tie / draw (`both_destroyed`) displays matching icons side‑by‑side, making the outcome visually obvious.
- **Sudden Death / RPS tie‑breaker flow:**
  - `TieBreakerModal` shows the chosen unit type (Rock/Paper/Scissors) for both sides, and a clear "DRAW — choose again" message on repeated ties.
  - When tie‑breaker choices are equal, we show a single tie result and then immediately restart the choice phase; no more looping/replaying combat overlay multiple times.
  - Automatic random choice still kicks in **only** when a player fails to pick within the 7‑second deadline; if both have chosen early, resolve immediately without waiting for the full timer.
- **"FIFA‑style" Matchup screen:**
  - New `MatchupScreen` overlay appears when both players are present and setup starts.
  - Shows each player’s name + team name with large glowing avatars in their team colors and a central animated **VS**.
  - Fades out automatically after a short intro, before normal setup and play.

### Connectivity, Turn Timer & Rematch

- **Turn timeout:** if a player does not move within 30 seconds, the server auto‑executes a random valid move for them and passes the turn.
- **Server-side turn enforcement (global game loop):**
  - A **global** `setInterval` runs every 1s and calls `checkExpiredTurns()`.
  - Each active room uses `turnDeadline` (set when turn starts and after each move/tie‑resolve).
  - When `Date.now() > turnDeadline`: server either performs a **random valid move** for the current player or, if no moves possible, **declares the other player winner** and persists the result. Both clients get state via existing `emitGameState` / `game_over` / `combat_event`.
- **Disconnect grace period:**
  - On `disconnect`, the server marks the player as temporarily offline and starts an **8s grace timer** (`DISCONNECT_GRACE_MS`).
  - If the player reconnects (same persistent player ID) before the timer fires, the game continues normally.
  - If the timer expires and the player is still offline, they are removed from the room and the remaining player wins with `disconnectWin: true`.
- **Opponent left UX:**
  - When one player leaves (explicit `leave_room` or after grace expiry), the remaining player:
    - Sees a banner: **"The other player left the room."** with a **Leave room** button.
    - Receives a `game_over` event with `disconnectWin: true`.
  - `FlagCaptureCelebration` hides the **Rematch** button when `disconnectWin` is true or no opponent is connected, so you can’t request a rematch from an empty room.

### Victory Animation

- `FlagCaptureCelebration` now:
  - Plays `capture_flag.mp4` for ~4 seconds for **all** wins (flag capture or no‑units).
  - Then transitions to a victory card with appropriate messaging:
    - `flag`: "FLAG CAPTURED! — 🏆 YOU WIN! 🏆"
    - `no_units`: "VICTORY! — 🏆 YOU WIN! 🏆"
  - Uses confetti effects and pulsing emojis for a more satisfying win moment.

### Session Additions: Lobby, Leaderboards, Kits, Preloader & Room Fixes

- **WelcomeScreen tabbed UI (authenticated):**
  - **לובי (Lobby):** Active rooms from `/api/rooms/active`, filter "חפש לפי קבוצה", "צור חדר חדש" when no rooms; room ID input and join.
  - **טבלאות (Leaderboard):** Toggle **שחקנים** / **קבוצות**; data from `/api/stats/players` and `/api/stats/groups`; **minimum 8 games** to be ranked (rank column shows "–" for unranked; footer note in Hebrew). Sorted: ranked first, then win rate desc, then wins desc.
  - **אזור אישי (Personal):** Player stats panel (Total Games, Wins, Losses, Win %, streak; **Draws removed**); head‑to‑head table (נ/ה only). Logout in top‑right corner.
- **Room is Full / ghost connections fixed:**
  - `join_room`: Debug logs (roomId, adapter size, Map state); **ghost pruning** — remove players whose socket ID no longer exists in `io.sockets.sockets`; if room empty after prune, delete and recreate; emit `room_update`.
  - `disconnect`: Remove player from custom `rooms` Map after grace; if room empty, delete key and emit `room_update`; clear timers. Client listens for `room_update` and refetches lobby list (`roomListVersion` in context).
- **Kit-based piece visuals (GamePiece.jsx):**
  - Asset path: `/assets/units/${kit}.${type}.png` (e.g. `red.rock.png`, `whiteandred.hidden.png`). Kits: red, blue, green, yellow, whiteandred, blackandred, blackandyellow, lightblue.
  - **Clash resolution:** `getClashKit(color)` maps same-kit opponent to away kit (e.g. red↔whiteandred, yellow↔blackandyellow). My pieces always use my kit; opponent uses their kit unless clash, then away kit. `toKitName()` normalizes hex to a kit name for compatibility.
  - Type: `(isMine || piece.revealed) ? piece.type : 'hidden'`. Exported `isColorClash(myTeamColor, opponentTeamColor)` for Board glow.
- **GameHUD (header):** Draws removed; single **🏆 Win%** badge; compact layout, truncate, `min-w-0`; **avatar clash** — when `forceColorSwap` (same team color), opponent avatar uses gold styling so it’s distinct.
- **AssetPreloader:** New component preloads all unit images (`ASSET_COLORS × ASSET_TYPES`). Shown in App when in room until `onComplete`; progress bar and "מכין את הלוח...". Integrated so game board appears only after preload (or after 500ms delay post-load).
- **Board performance:** `BoardCell` wrapped in `React.memo` with custom `areCellPropsEqual` so cells don’t re-render when only the global turn timer updates; `handleCellClick` in `useCallback`.
- **Seed:** Teams seeded with **asset prefix** in `color` (e.g. `red`, `whiteandred`); `totalWins`/`totalLosses`; Hebrew comments and emoji console output. Prisma schema uses `totalWins`/`totalLosses` on Group.
- **Persistence & stats APIs (already wired):** Game results persisted via `recordGameResultForRoom`; `/api/rooms/active`, `/api/stats/players`, `/api/stats/groups`, `/api/stats/me`, `/api/stats/headtohead`; leaderboard and personal stats UI in WelcomeScreen tabs.

---

## 2. Technical Changes (Key Files)

| File | Changes |
|------|---------|
| `client/src/components/WelcomeScreen.jsx` | Glassmorphism, RTL Hebrew auth; **tabbed UI:** לובי (active rooms, filter, create room), טבלאות (players/groups leaderboard with 8-game min), אזור אישי (stats, no Draws); logout in corner. |
| `client/src/components/GameHUD.jsx` | Single top HUD; team name + colored indicator; **Draws removed**, compact **🏆 Win%** badge; **avatar clash** (forceColorSwap = gold when same team color); truncate, min-w-0. |
| `client/src/components/GamePiece.jsx` | **Kit-based assets:** `/assets/units/${kit}.${type}.png`; `getClashKit()` for clash; `toKitName()`; `isColorClash()` export; selection ring. |
| `client/src/components/AssetPreloader.jsx` | **New.** Preloads all unit images by color×type; progress bar; `onComplete`; used before showing game board. |
| `client/src/components/Board.jsx` | 6×6 layout; **BoardCell** memoized with custom `areCellPropsEqual`; `useCallback` for cell click; passes `piece`, `myTeamColor`, `opponentTeamColor` to GamePiece; `isColorClash` for displayColor/glow. |
| `client/src/components/PlayerStatsPanel.jsx` | **Draws removed** from stats grid and head‑to‑head column (נ/ה only). |
| `client/src/components/MatchupScreen.jsx` | New FIFA‑style matchup overlay: big team‑colored avatars, names, team names, and animated VS intro. |
| `client/src/components/SetupBoard.jsx` | Setup board styling; dark theme and rotation for top player setup. |
| `client/src/components/CombatModal.jsx` | Rich RPS animations; clear "Your unit" vs "Opponent" labels; visualized draw (same icon vs same icon). |
| `client/src/components/TieBreakerModal.jsx` | Sudden Death UI; shows both weapon icons; refined tie messaging; preserves full 7s for manual choices. |
| `client/src/components/FlagCaptureCelebration.jsx` | Unified victory animation with `capture_flag.mp4`; hides Rematch on `disconnectWin`; uses `winType` and `disconnectWin` to adjust copy/UX. |
| `client/src/App.jsx` | `WelcomeScreen` when not in room; **AssetPreloader** when in room until `assetsLoaded`; then GameHUD, MatchupScreen, Emoji bar, Board/SetupBoard. |
| `client/public/manifest.webmanifest` | PWA metadata (name `"אחסן, נייר ומספריים"`, icons, theme/background colors). |
| `client/public/sw.js` | Minimal service worker to enable installability (no offline caching yet). |
| `client/index.html` | Orbitron font; PWA meta tags; **preload** for legacy unit images (unit-rock, unit-paper, etc.). |
| `client/src/main.jsx` | Registers the service worker on `window.load`. |
| `client/src/context/GameContext.jsx` | Auth state; **roomListVersion** + `room_update` listener for lobby refetch; Socket.IO with `auth.token`; turn timers, combat/tie‑breaker, disconnect, emoji, `joinRoom`. |
| `server/prisma/schema.prisma` | Prisma models for `Group` (with team color), `User` (with group and game relations) and `Game` (playerA/B, winner, createdAt). |
| `server/prisma/seed.js` | Seeds Israeli Premier League teams with **asset prefix** in `color` (red, whiteandred, blue, etc.); `totalWins`/`totalLosses`; Hebrew comments; emoji console (🗑️ 🌱 ✅). |
| `server/controllers/authController.js` | `register` + `login` with bcrypt hashing, JWT issuance, and group assignment via Prisma. |
| `server/controllers/statsController.js` | Functions for user stats and head‑to‑head records (wins / losses / draws). |
| `server/controllers/gameController.js` | `saveGameResult` for persisting game outcomes. |
| `server/index.js` | Express + Socket.IO; JWT middleware; **join_room:** debug logs, ghost pruning, `turnDeadline`; **disconnect:** remove player from `rooms` Map, delete empty room, emit `room_update`; **global** `checkExpiredTurns()` every 1s; `/api/rooms/active`, `/api/stats/players`, `/api/stats/groups` (gamesPlayed, isRanked ≥8, sort); `/auth/*`, `/health`. |
| `Dockerfile` | Multi‑stage Debian (`node:20-slim`) build: builds client, installs server deps, ensures OpenSSL installed; runs `npx prisma generate && node index.js` at startup. |

---

## 3. Current Known Bugs & UX Gaps

### 3.1 iOS PWA Keyboard (High Priority)

- **Symptom:** When the app is installed as a PWA on iOS (Chrome or Safari "Add to Home Screen"), tapping the inputs on `WelcomeScreen` does **not** consistently show the iOS virtual keyboard and no text caret appears.
- **Scope:**
  - Works correctly in regular mobile browsers (Chrome/Safari tabs on iOS) and on Android PWA.
  - The issue is specific to iOS standalone/PWA mode.
- **Hypothesis:** iOS WebKit PWA quirk around focus/input handling in standalone mode; not obviously related to `pointer-events`, `fixed` layout, or transforms (we already removed the usual suspects and kept the layout simple).
- **Candidate solution:** Implement a small custom in‑game virtual keyboard (overlay of buttons writing into React state) for entering Room ID and credentials when running as iOS PWA, or continue iterating with tightly scoped focus workarounds.

### 3.2 Tie‑Breaker UX Polish

- The tie/draw loop bug is largely addressed (no more repeated combat overlays), but the Sudden Death experience still needs more real‑device QA:
  - Ensure the flow is always: **Battle → Draw shown once → immediate return to choice → resolve**.
  - Verify there is no perceived "lost seconds" from overlapping delays and timers, especially on mobile.

### 3.3 Persistence / Data Layer

- **Implemented:**
  - Postgres + Prisma schema with `Group`, `User`, `Game` models.
  - Registration/login with hashed passwords; groups seeded with **asset-prefix** colors (red, whiteandred, etc.).
  - Game results persisted via `recordGameResultForRoom` / `saveGameResult` when a match ends.
  - **APIs:** `/api/rooms/active`, `/api/stats/players`, `/api/stats/groups` (with gamesPlayed, isRanked ≥8), `/api/stats/me`, `/api/stats/headtohead`.
  - **UI:** WelcomeScreen tabs show active rooms (Lobby), leaderboards (Players/Groups with min 8 games), and personal stats + head‑to‑head (Personal).
- **Still missing:**
  - **Live rooms** are in‑memory only (Socket.IO `rooms` map); not recoverable after server restart.
  - No match-history list or ELO/rating system.

---

## 4. Next Steps

1. **iOS PWA Input Strategy**
   - Decide on a final approach for iOS PWA:
     - (Preferred) Build a small **custom virtual keyboard** for entering Room ID and credentials when running as iOS PWA.
     - Or continue exploring focused iOS PWA workarounds without over‑complicating the Welcome screen for non‑PWA users.

2. **Battle & Tie UX (real-device QA)**
   - Run end‑to‑end tests on real devices (PWA on Android, mobile browsers on iOS).
   - Tweak **pre‑battle delay**, animations, tie messaging, and Matchup intro timing from playtest feedback.
   - Confirm all tie‑breaker flows (tie, tie‑again, resolve, timeout) feel smooth and do not steal time from the 7s window.

3. **Database / env setup (if not already done)**
   - Ensure `DATABASE_URL` and `prisma migrate deploy` (or migrations) are run in the deployment environment so Postgres is used in production.

4. **Regression & smoke tests**
   - Checklist or light automation: room create/join, setup, play, combat, tie, flag capture, no‑units win; disconnect/reconnect within and beyond 8s grace; PWA install on Android/iOS and basic flows.

---

## 5. Environment

- **Stack:** React (Vite), Tailwind CSS, Framer Motion
- **Backend:** Node.js, Express, Socket.io, Prisma (Postgres)
- **PWA:** Vite + custom `manifest.webmanifest` + minimal `sw.js` (installable; not yet offline‑first)
- **Deployment target:** Easypanel (Docker), port 3000
