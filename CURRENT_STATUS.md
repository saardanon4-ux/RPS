# RPS Stratego – Current Status

> **Purpose:** This document provides context for the next AI session. Read it first to understand where we left off.

---

## Project Overview

A 2-player RPS Stratego game ("אחסן, נייר ומספריים") with JWT auth, real-time Socket.IO play, leaderboards, rivalry (head-to-head) stats, and PWA installability—deployed via Docker (Easypanel, port 3000).

---

## Accomplished Today

- **Rematch persistence (bug fix):** Second game after rematch was not recorded because `room.resultPersisted` stayed `true`. Reset `room.resultPersisted = false` in `startSetupPhase(room)` in `server/index.js` so each rematch can persist its result.
- **Tie-breaker same-choice UX (bug fix):** When both players chose the same tool in sudden death, the combat modal did not show until the server’s restart (~2.8s), allowing inference of the opponent’s choice. In `client/src/context/GameContext.jsx`, `onTieBreakTie` now triggers the same combat flow as a resolved battle: set `combatPending`, then after `PRE_BATTLE_DELAY_MS` set `combatState` so the CombatModal shows the tie immediately; server already emitted `tie_break_tie` on same choice.
- **Rivalry API (getHeadToHead):** Rewrote `server/controllers/statsController.js` `getHeadToHead` to query all games between the two users (`OR: [{ playerAId, playerBId }, { playerAId, playerBId }]`) and count wins/losses/draws from the current user’s perspective (`winnerId === current` → wins, `winnerId === opponent` → losses, else draws). Returns `{ wins, losses, draws, totalGames }`.
- **Debug instrumentation:** Added fetch-based logs in `server/index.js` (inside `// #region agent log` / `// #endregion`) for rematch (`recordGameResultForRoom`, `startSetupPhase` with `resultPersisted`) and tie-breaker (`submit_tie_choice`, `resolveTieBreaker`). Logs post to an ingest URL; intended for verification only—to be removed after user confirms both fixes.

---

## Current State

- **Auth & lobby:** Login/register with team selection, JWT, Socket.IO auth; WelcomeScreen with Lobby (active rooms), Leaderboards (players/groups, min 8 games), Personal (stats + head-to-head).
- **Gameplay:** Setup, turn-based play, combat modal, tie-breaker (sudden death) with immediate combat display when both choose the same tool; flag capture and no-units wins; turn timeout and disconnect grace period.
- **Rematch:** Both players can request rematch; `startSetupPhase` resets `resultPersisted`, so the second (and later) game results are persisted via `recordGameResultForRoom` → `saveGameResult`.
- **Stats:** Game results persisted to Postgres; `/api/stats/me`, `/api/stats/headtohead` (rivalry); leaderboards and personal stats UI in WelcomeScreen.
- **PWA:** manifest, sw, installable; iOS PWA keyboard issue remains (see Known Issues).

---

## Pending / Next Steps

- Remove debug instrumentation in `server/index.js` (all `// #region agent log` blocks and their fetch calls) once user confirms rematch and tie-breaker fixes.
- **iOS PWA:** Implement custom virtual keyboard or other workaround for inputs not focusing/showing system keyboard when installed as PWA on iOS.
- **Tie-breaker QA:** Real-device testing of sudden-death flow (delays, 7s window, no lost seconds).
- **Ops:** Ensure `DATABASE_URL` and Prisma migrations in deployment; optional regression/smoke checklist (room join, setup, combat, tie, rematch, disconnect).

---

## Known Issues

- **iOS PWA keyboard:** On iOS PWA (Add to Home Screen), WelcomeScreen inputs often do not show the system keyboard or caret; works in mobile browser tabs and on Android PWA.
- **Ingest/log pipeline:** Debug logs were configured to post to an ingest endpoint; `.cursor/debug.log` was not populated during reproduction (tooling/config), so file-based verification of rematch/tie-breaker was not done.
