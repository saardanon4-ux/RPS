# RPS Stratego – Current Status

> **Purpose:** This document provides context for the next AI session. Read it first to understand where we left off.

---

## 1. Recent Accomplishments

### Glassmorphism Welcome Screen
- Replaced basic Lobby login with a `WelcomeScreen` component
- Animated gradient background (deep blue to purple)
- Glassmorphism card with semitransparent blur and white border
- Orbitron font for "STRATEGO BATTLE" title
- Inputs with focus effects (amber glow)
- Join Game button with glow and Framer Motion scale-on-hover

### Board Orientation (Bottom Perspective)
- Local player always sees their pieces at the bottom of the screen
- **Player 2 (Blue):** Board container uses `transform: rotate(180deg)` so their units appear at bottom
- **Counter-rotation:** Each grid cell gets `transform: rotate(180deg)` so pieces stay upright when the board is rotated

### In-Game HUD Redesign
- Replaced split top/bottom `PlayerBanner` components with a single `GameHUD` component
- **Layout:** `[Player 1 Name/Avatar] -- [Timer/Status] -- [Player 2 Name/Avatar]` in one header bar
- **Turn indicator:** Active player has green glow, scale-up, and text-shadow; waiting player is dimmed (opacity-50)

### Battle Location Indicator
- Pulsing red border (`ring-4 ring-red-500 animate-pulse`) on combat cells
- Crossed swords icon (⚔️) overlay on the target battle square

### Draw Result Feedback
- "🤝 DRAW" overlay on the battle square when result is `both_destroyed`
- Grey/silver background flash with `animate-pulse` on the draw square

---

## 2. Technical Changes (Modified Files)

| File | Changes |
|------|---------|
| `client/src/components/WelcomeScreen.jsx` | **New.** Glassmorphism login screen with animated gradient |
| `client/src/components/GameHUD.jsx` | **New.** Single header bar with Player 1, Timer, Player 2 |
| `client/src/components/PlayerBanner.jsx` | **Largely unused.** Replaced by GameHUD during gameplay |
| `client/src/components/Board.jsx` | Board rotation logic, combat cell highlighting, crossed swords overlay, draw feedback, enemy unit rotation |
| `client/src/components/SetupBoard.jsx` | Board rotation for Player 2 during setup, dark theme text colors |
| `client/src/components/FlagCaptureCelebration.jsx` | `winType` prop for flag vs no-units victory, Orbitron styling |
| `client/src/App.jsx` | Uses WelcomeScreen when not in room; GameHUD instead of PlayerBanners; turn timer moved to App |
| `client/index.html` | Added Orbitron font |

---

## 3. Current Known Bugs

### Red Player Pieces Appearing Upside Down
- **Symptom:** After the rotation update, when viewed by Player 1 (Blue), the opponent's pieces (Red/Player 2) appear upside down at the top of the board.
- **Root cause:** Attempted fix: enemy unit images get `transform: rotate(180deg)` when `!isPlayer2` to "face" the local player. This may be causing the upside-down appearance instead of fixing it.
- **Location:** `Board.jsx` – `imgProps.style` for `isEnemyUnit`:
  ```js
  style: isEnemyUnit
    ? { filter: 'hue-rotate(180deg) brightness(90%)', transform: !isPlayer2 ? 'rotate(180deg)' : undefined }
    : undefined,
  ```
- **Next action:** Revisit the enemy unit rotation logic. The intent was for enemy pieces to face the local player; the current approach may be incorrect. Consider removing the enemy `rotate(180deg)` or inverting the condition.

---

## 4. Next Steps

1. **Fix upside-down Red/Player 2 pieces** – Adjust or remove the enemy unit `transform: rotate(180deg)` in `Board.jsx` so opponent pieces display correctly.
2. **Test board orientation** – Confirm both Player 1 and Player 2 see their own units at the bottom and upright.
3. **Smoke test** – Run through join room, setup, gameplay, combat, draw, rematch to ensure no regressions.

---

## 5. Environment

- **Stack:** React (Vite), Tailwind CSS, Framer Motion
- **Backend:** Node.js, Express, Socket.io
- **Deployment target:** Easypanel (Docker), port 3000
