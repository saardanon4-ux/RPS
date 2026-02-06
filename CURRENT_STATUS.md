# RPS Stratego / "אחסן, נייר ומספריים" – Current Status

> **Purpose:** This document provides context for the next AI session. Read it first to understand where we left off.

---

## 1. Recent Accomplishments

### Welcome Screen & PWA Readiness

- Glassmorphism `WelcomeScreen` replaces the old Lobby login.
- Animated gradient background + subtle grid overlay, Orbitron title.
- Primary title updated to **"אחסן, נייר ומספריים"**, secondary line **"STRATEGO BATTLE"**.
- Inputs have focus styling and work correctly in regular mobile/desktop browsers.
- Basic PWA wiring in place:
  - `manifest.webmanifest` with name/short_name, theme/background colors, and icons.
  - Minimal `sw.js` and registration in `main.jsx` so the app is installable (works well on Android and desktop).
  - iOS meta tags (`apple-mobile-web-app-*`) configured.

> ⚠️ On iOS PWA (installed to home screen), the system keyboard still does **not** appear reliably on the WelcomeScreen inputs. See "Known Bugs & UX Gaps".

### Board Orientation & Layout

- Local player always sees their pieces at the bottom.
- **Player 2 (top side):** board container uses `transform: rotate(180deg)` so their pieces appear at the bottom.
- Each grid cell is counter‑rotated so units stay upright.
- **Red / Player 2 upside‑down bug fixed:** removed extra `rotate(180deg)` from enemy units in `Board.jsx`; both players now see the opponent upright.
- Board tiles now use a stable layout (`aspect-square` on the outer wrapper, `w-full h-full` on the inner tile) so cells remain square and consistent on mobile, even with rings/hover/animations.

### In‑Game HUD & Feedback

- Old top/bottom `PlayerBanner` replaced with a single `GameHUD` across the top:
  - Layout: `[Player 1] — [Timer/Status] — [Player 2]`.
  - Active player gets green glow and scale‑up; waiting player is dimmed.

### Battle & Tie UX

- **Battle location indicator:** Only the **target battle cell** now gets a pulsing red ring (`ring-4 ring-red-600 animate-pulse`), with a short pre‑battle delay (~900ms) so players clearly see where the combat is happening before the modal appears.
- **Draw feedback on board:** The draw square shows a 🤝 "DRAW" overlay plus grey/silver pulse when `result === 'both_destroyed'`.
- **Combat modal enhancements:**
  - Shows both attacker and defender icons (Rock/Paper/Scissors/Trap) with clear labels: **"Your unit"** vs **"Opponent"**.
  - Tie / draw (`both_destroyed`) displays matching icons side‑by‑side, making the outcome visually obvious.
- **Sudden Death / RPS tie‑breaker flow:**
  - `TieBreakerModal` shows the chosen unit type (Rock/Paper/Scissors) for both sides, and a clear "DRAW — choose again" message on repeated ties.
  - When tie‑breaker choices are equal, we show a single tie result and then immediately restart the choice phase; no more looping/replaying combat overlay multiple times.
  - Automatic random choice still kicks in **only** when a player fails to pick within the 7‑second deadline; if both have chosen early, resolve immediately without waiting for the full timer.

### Connectivity, Turn Timer & Rematch

- **Turn timeout:** if a player does not move within 30 seconds, the server auto‑executes a random valid move for them and passes the turn.
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

---

## 2. Technical Changes (Key Files)

| File | Changes |
|------|---------|
| `client/src/components/WelcomeScreen.jsx` | Glassmorphism login screen; Hebrew primary title + STRATEGO subtitle; refined layout for mobile; inputs wired for browsers (text, focus, `inputMode`) |
| `client/src/components/GameHUD.jsx` | Single top HUD with players and turn timer |
| `client/src/components/PlayerBanner.jsx` | Largely unused; replaced by `GameHUD` during gameplay |
| `client/src/components/Board.jsx` | Stable 6×6 layout with `aspect-square` outer tiles; bottom‑perspective rotation; fixed enemy rotation; combat target highlighting with pre‑battle delay; draw overlays |
| `client/src/components/SetupBoard.jsx` | Setup board styling; dark theme and rotation for top player setup |
| `client/src/components/CombatModal.jsx` | Rich RPS animations; clear "Your unit" vs "Opponent" labels; visualized draw (same icon vs same icon) |
| `client/src/components/TieBreakerModal.jsx` | Sudden Death UI; shows both weapon icons; refined tie messaging; preserves full 7s for manual choices |
| `client/src/components/FlagCaptureCelebration.jsx` | Unified victory animation with `capture_flag.mp4`; hides Rematch on `disconnectWin`; uses `winType` and `disconnectWin` to adjust copy/UX |
| `client/src/App.jsx` | Uses `WelcomeScreen` when not in a room; uses `GameHUD`; tracks per‑turn countdown and opponent‑left banner |
| `client/public/manifest.webmanifest` | PWA metadata (name `"אחסן, נייר ומספריים"`, icons, theme/background colors) |
| `client/public/sw.js` | Minimal service worker to enable installability (no offline caching yet) |
| `client/index.html` | Orbitron font; PWA meta tags (theme‑color, manifest, Apple PWA tags, touch icon) |
| `client/src/main.jsx` | Registers the service worker on `window.load` |
| `client/src/context/GameContext.jsx` | Turn timers, combat/tie‑breaker orchestration, pre‑battle delay, disconnect handling, grace timers, and `disconnectWin` propagation |
| `server/index.js` | Turn timeout logic; tie‑breaker resolution with improved tie handling; 8s disconnect grace period before declaring a winner; `disconnectWin` flag in `game_over` events |

---

## 3. Current Known Bugs & UX Gaps

### 3.1 iOS PWA Keyboard (High Priority)

- **Symptom:** When the app is installed as a PWA on iOS (Chrome or Safari "Add to Home Screen"), tapping the `Room ID` or `Player Name` fields on `WelcomeScreen` does **not** consistently show the iOS virtual keyboard and no text caret appears.
- **Scope:**
  - Works correctly in regular mobile browsers (Chrome/Safari tabs on iOS) and on Android PWA.
  - The issue is specific to iOS standalone/PWA mode.
- **Hypothesis:** iOS WebKit PWA quirk around focus/input handling in standalone mode; not obviously related to `pointer-events`, `fixed` layout, or transforms (we already removed the usual suspects and kept the layout simple).
- **Candidate solution:** Implement a small custom in‑game virtual keyboard (overlay of buttons writing into React state) for entering `Room ID` and `Player Name` when running as iOS PWA, or continue iterating with tightly scoped focus workarounds.

### 3.2 Tie‑Breaker UX Polish

- The tie/draw loop bug is largely addressed (no more repeated combat overlays), but the Sudden Death experience still needs more real‑device QA:
  - Ensure the flow is always: **Battle → Draw shown once → immediate return to choice → resolve**.
  - Verify there is no perceived "lost seconds" from overlapping delays and timers, especially on mobile.

### 3.3 Persistence / Data Layer (Not Yet Implemented)

- Game server is currently in‑memory only:
  - No persistent database for match history, player stats, or reconnectable long‑lived rooms.
  - No account system / ELO / ladder yet.

---

## 4. Next Steps

1. **iOS PWA Input Strategy**
   - Decide on a final approach for iOS PWA:
     - (Preferred) Build a small **custom virtual keyboard** for entering `Room ID` and `Player Name` when running as iOS PWA.
     - Or continue exploring focused iOS PWA workarounds, but avoid over‑complicating the main Welcome screen for non‑PWA users.

2. **Battle & Tie UX Finalization**
   - Run end‑to‑end tests on real devices (including PWA on Android & mobile browsers on iOS).
   - Tweak pre‑battle delay, animations, and tie messaging based on playtest feedback.
   - Confirm that **all** tie‑breaker flows (tie, tie‑again, resolve, timeout) feel smooth and do not steal time from the 7s decision window.

3. **Persistence / Database Setup**
   - Introduce a database (e.g. Postgres) for:
     - Player identities / profiles.
     - Match history and stats (wins/losses, ELO/rating, streaks).
     - Potential future features like reconnecting to active matches or leaderboards.
   - Update the backend (`server/index.js`) to persist and restore state, not just keep it in memory.

4. **Regression & Smoke Tests**
   - Create a small checklist or automated tests that cover:
     - Room creation/join, setup phase, play, combat, tie, flag capture, no‑units win.
     - Disconnect/reconnect within and beyond the 8s grace window.
     - PWA install/uninstall on Android and iOS; verify basic flows after install.

5. **Collaboration / Agent Behavior**
   - When using the AI agent, **only apply code changes that were explicitly requested by the user**.
   - Avoid bundling multiple unrelated changes into a single step unless the user has clearly asked for a broader refactor.
   - Keep changes surgical and easy to reason about so debugging and rollbacks remain simple.

---

## 5. Environment

- **Stack:** React (Vite), Tailwind CSS, Framer Motion
- **Backend:** Node.js, Express, Socket.io
- **PWA:** Vite + custom `manifest.webmanifest` + minimal `sw.js` (installable; not yet offline‑first)
- **Deployment target:** Easypanel (Docker), port 3000
