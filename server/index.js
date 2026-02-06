import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { register as registerUser, login as loginUser } from './controllers/authController.js';
import { saveGameResult } from './controllers/gameController.js';
import { getUserStats, getHeadToHeadSummaryForUser } from './controllers/statsController.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();
const app = express();
app.use(express.json());

const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-me';

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  }),
);
const httpServer = createServer(app);

const io = new Server(httpServer, {
  // Relaxed heartbeat settings to be friendlier to slow / mobile networks
  pingTimeout: 60000,
  pingInterval: 25000,
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3001;
const GRID_SIZE = 6;
const RPS_BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
const RPS_TYPES = ['rock', 'paper', 'scissors'];
const IMMOBILE_TYPES = ['flag', 'trap'];
const SETUP_DURATION_SEC = 40;
const TIE_BREAKER_DURATION_MS = 7000;
const TURN_TIMEOUT_SEC = 30;
const DISCONNECT_GRACE_MS = 8000;

function makeBattleId(prefix = 'battle') {
  return `${prefix}-${Date.now()}-${crypto.randomUUID()}`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createEmptyGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => null));
}

function getPlayerSetupSlots(side) {
  if (side === 'bottom') {
    return [
      [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5],
      [5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5],
    ];
  }
  return [
    [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5],
  ];
}

function buildGameStateFromSetup(room) {
  const grid = room.setupGrid.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
  const player1 = room.players.find((p) => p.side === 'bottom');
  return { grid, currentTurn: player1.id, players: room.players };
}

function sanitizeGameStateForPlayer(gameState, playerId) {
  const grid = gameState.grid.map((row) =>
    row.map((cell) => {
      if (!cell) return null;
      const isOwnUnit = cell.owner === playerId;
      const showType = isOwnUnit || cell.revealed === true;
      return { ...cell, type: showType ? cell.type : 'hidden' };
    })
  );
  return { ...gameState, grid };
}

function getAdjacentCells(row, col) {
  const adj = [];
  if (row > 0) adj.push([row - 1, col]);
  if (row < GRID_SIZE - 1) adj.push([row + 1, col]);
  if (col > 0) adj.push([row, col - 1]);
  if (col < GRID_SIZE - 1) adj.push([row, col + 1]);
  return adj;
}

function countMobileUnits(grid, playerId) {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell && cell.owner === playerId && !IMMOBILE_TYPES.includes(cell.type)) count++;
    }
  }
  return count;
}

function emitGameState(room) {
  const payload = { turnStartTime: room.turnStartTime };
  room.players.forEach((p) => {
    if (!p.socketId) return;
    const sanitized = sanitizeGameStateForPlayer(room.gameState, p.id);
    io.to(p.socketId).emit('game_state_update', { gameState: { ...sanitized, ...payload } });
  });
}

function resolveTieBreaker(room) {
  const tb = room.tieBreaker;
  if (!tb || room.phase !== 'TIE_BREAKER') return;
  if (tb.isResolving) return;
  tb.isResolving = true;
  if (tb.timeoutId) clearTimeout(tb.timeoutId);
  if (tb.restartTimeoutId) {
    clearTimeout(tb.restartTimeoutId);
    tb.restartTimeoutId = null;
  }

  const attackerId = tb.attackerId;
  const defenderOwnerId = tb.defenderOwnerId;
  const { fromRow, fromCol, toRow, toCol } = tb;
  const grid = room.gameState.grid;
  const fromCell = grid[fromRow]?.[fromCol];
  const toCell = grid[toRow]?.[toCol];

  // Auto-pick random for any player who didn't submit within the time limit
  if (!tb.choices[attackerId]) tb.choices[attackerId] = RPS_TYPES[Math.floor(Math.random() * 3)];
  if (!tb.choices[defenderOwnerId]) tb.choices[defenderOwnerId] = RPS_TYPES[Math.floor(Math.random() * 3)];

  const choice1 = tb.choices[attackerId];
  const choice2 = tb.choices[defenderOwnerId];

  if (choice1 === choice2) {
    // Same choice - show combat (tie) then restart
    const battleId = `${tb.encounterId}:draw:${tb.round ?? 0}`;
    if (tb.lastEmittedBattleId === battleId) {
      tb.isResolving = false;
      return;
    }
    tb.lastEmittedBattleId = battleId;
    const tieCombatResult = { attackerType: choice1, defenderType: choice2, result: 'both_destroyed' };
    room.players.forEach((p) => {
      if (!p.socketId) return;
      const entry = sanitizeGameStateForPlayer(room.gameState, p.id);
      io.to(p.socketId).emit('tie_break_tie', {
        battleId,
        combatResult: tieCombatResult,
        attackerId,
        fromRow: tb.fromRow, fromCol: tb.fromCol, toRow: tb.toRow, toCol: tb.toCol,
        newGameState: entry,
      });
    });
    tb.choices = {};
    // Give players a full choice window AFTER the reveal animation.
    tb.restartTimeoutId = setTimeout(() => {
      if (!room.tieBreaker) return;
      tb.round = (tb.round ?? 0) + 1;
      const restartBattleId = `${tb.encounterId}:restart:${tb.round}`;
      tb.deadline = Date.now() + TIE_BREAKER_DURATION_MS;
      if (tb.timeoutId) clearTimeout(tb.timeoutId);
      tb.timeoutId = setTimeout(() => resolveTieBreaker(room), TIE_BREAKER_DURATION_MS);
      room.players.forEach((p) => {
        if (!p.socketId) return;
        io.to(p.socketId).emit('tie_break_restart', {
          battleId: restartBattleId,
          deadline: tb.deadline,
          fromRow: tb.fromRow, fromCol: tb.fromCol, toRow: tb.toRow, toCol: tb.toCol,
        });
      });
      tb.isResolving = false;
    }, 2800);
    // Allow future resolves after we schedule restart.
    tb.isResolving = false;
    return;
  }

  // One wins - apply combat
  const attackerWins = RPS_BEATS[choice1] === choice2;
  let combatResult;
  if (attackerWins) {
    grid[toRow][toCol] = { ...fromCell, type: choice1, revealed: true };
    grid[fromRow][fromCol] = null;
    combatResult = { attackerType: choice1, defenderType: choice2, result: 'attacker_wins' };
  } else {
    grid[fromRow][fromCol] = null;
    grid[toRow][toCol] = { ...toCell, type: choice2, revealed: true };
    combatResult = { attackerType: choice1, defenderType: choice2, result: 'defender_wins' };
  }

  room.phase = 'PLAYING';
  room.tieBreaker = null;
  room.gameState.currentTurn = room.players.find((p) => p.id !== attackerId)?.id ?? room.gameState.currentTurn;
  room.turnStartTime = Date.now();
  room.turnDeadline = Date.now() + TURN_TIMEOUT_SEC * 1000;

  let gameOver = null;
  room.players.forEach((p) => {
    const mobile = countMobileUnits(grid, p.id);
    if (mobile === 0) gameOver = room.players.find((x) => x.id !== p.id)?.id ?? null;
  });
  if (gameOver) room.phase = 'GAME_OVER';

  room.players.forEach((p) => {
    if (!p.socketId) return;
    const entry = sanitizeGameStateForPlayer(room.gameState, p.id);
    io.to(p.socketId).emit('tie_break_resolved', {
      battleId: `${tb.encounterId}:resolve:${tb.round ?? 0}`,
      combatResult, attackerId,
      fromRow: tb.fromRow, fromCol: tb.fromCol, toRow: tb.toRow, toCol: tb.toCol,
      newGameState: entry,
    });
  });
  if (gameOver) {
    room.rematchRequested = {};
    room.lastWinnerId = gameOver;
    room.lastFlagCapture = false;
    room.players.forEach((p) => {
      if (!p.socketId) return;
      io.to(p.socketId).emit('game_over', { winnerId: gameOver, flagCapture: false });
    });
    // Persist result when tie-breaker concludes the game
    recordGameResultForRoom(room, gameOver);
  }
  // Done resolving this encounter.
  tb.isResolving = false;
}

function countPlacedForPlayer(grid, playerId, side) {
  const slots = getPlayerSetupSlots(side);
  const counts = { rock: 0, paper: 0, scissors: 0, flag: 0, trap: 0 };
  slots.forEach(([r, c]) => {
    const cell = grid[r]?.[c];
    if (cell && cell.owner === playerId && cell.type) counts[cell.type]++;
  });
  return counts;
}

function smartFillEmptySlots(room, playerId) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return;
  const slots = getPlayerSetupSlots(player.side);
  const emptySlots = slots.filter(([r, c]) => !room.setupGrid[r]?.[c]);
  const totalEmpty = emptySlots.length;
  if (totalEmpty === 0) return;
  const placed = countPlacedForPlayer(room.setupGrid, playerId, player.side);
  const needFlag = Math.max(0, 1 - placed.flag);
  const needTrap = Math.max(0, 1 - placed.trap);
  const needRPS = Math.max(0, 10 - placed.rock - placed.paper - placed.scissors);
  const toPlace = [];
  for (let i = 0; i < needFlag; i++) toPlace.push('flag');
  for (let i = 0; i < needTrap; i++) toPlace.push('trap');
  let rpsToAdd = totalEmpty - toPlace.length;
  rpsToAdd = Math.max(0, Math.min(rpsToAdd, needRPS));
  const rockCount = Math.ceil(rpsToAdd / 3);
  const paperCount = Math.ceil((rpsToAdd - rockCount) / 2);
  const scissorsCount = rpsToAdd - rockCount - paperCount;
  for (let i = 0; i < rockCount; i++) toPlace.push('rock');
  for (let i = 0; i < paperCount; i++) toPlace.push('paper');
  for (let i = 0; i < scissorsCount; i++) toPlace.push('scissors');
  const shuffled = shuffle(toPlace);
  // Shuffle BOTH the pieces and the coordinates to avoid perceived clustering.
  const shuffledSlots = shuffle(emptySlots);
  for (let i = 0; i < totalEmpty && i < shuffled.length; i++) {
    const [r, c] = shuffledSlots[i];
    const type = shuffled[i];
    room.setupGrid[r][c] = {
      type,
      id: `${player.side}-${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      owner: playerId,
      ownerSide: player.side,
      revealed: false,
    };
  }
}

function startSetupPhase(room) {
  room.phase = 'SETUP';
  room.setupGrid = createEmptyGrid();
  room.setupReady = {};
  room.setupTimerEnd = Date.now() + SETUP_DURATION_SEC * 1000;
  room.gameState = null;
  room.tieBreaker = null;
  room.rematchRequested = null;
  room.lastWinnerId = null;
  room.lastFlagCapture = null;

  room.players.forEach((p) => {
    room.setupReady[p.id] = false;
  });

  const rid = room.roomId;
  room.setupInterval = setInterval(() => {
    const r = rooms.get(rid);
    if (!r) return;
    const room = r;
    if (!room || room.phase !== 'SETUP') return;
    const remaining = Math.max(0, Math.ceil((room.setupTimerEnd - Date.now()) / 1000));
    io.to(room.roomId).emit('setup_timer', { remaining });
    if (remaining <= 0) {
      clearInterval(room.setupInterval);
      room.players.forEach((p) => {
        if (!room.setupReady[p.id]) {
          smartFillEmptySlots(room, p.id);
          room.setupReady[p.id] = true;
        }
      });
      transitionToPlaying(room);
    }
  }, 1000);

  const playersPayload = room.players.map((p) => ({
    id: p.id,
    name: p.name,
    side: p.side,
    teamName: p.teamName,
    teamColor: p.teamColor,
    wins: p.wins,
    losses: p.losses,
    draws: p.draws,
  }));
  room.players.forEach((p) => {
    if (!p.socketId) return;
    const gridForPlayer = room.setupGrid.map((row) =>
      row.map((c) => (c && c.owner === p.id ? { ...c } : null))
    );
    io.to(p.socketId).emit('setup_start', {
      phase: 'SETUP',
      roomId: room.roomId,
      players: playersPayload,
      grid: gridForPlayer,
      setupReady: room.setupReady,
    });
  });
}

function getValidMovesForPlayer(room, playerId) {
  const grid = room.gameState.grid;
  const moves = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = grid[r]?.[c];
      if (!cell || cell.owner !== playerId || IMMOBILE_TYPES.includes(cell.type)) continue;
      const adj = getAdjacentCells(r, c);
      for (const [tr, tc] of adj) {
        const target = grid[tr]?.[tc];
        if (!target) moves.push([r, c, tr, tc]);
        else if (target.owner !== playerId) moves.push([r, c, tr, tc]);
      }
    }
  }
  return moves;
}

function executeMove(room, fromRow, fromCol, toRow, toCol, movingPlayerId) {
  const gs = room.gameState;
  const grid = gs.grid;
  const fromCell = grid[fromRow]?.[fromCol];
  const toCell = grid[toRow][toCol];
  const isToEmpty = !toCell;
  let gameOver = null;
  let combatResult = null;

  if (isToEmpty) {
    grid[toRow][toCol] = { ...fromCell, revealed: fromCell.revealed ?? false };
    grid[fromRow][fromCol] = null;
  } else {
    const defender = toCell;
    if (defender.type === 'trap') {
      grid[fromRow][fromCol] = null;
      combatResult = { attackerType: fromCell.type, defenderType: 'trap', result: 'trap_kills' };
    } else if (defender.type === 'flag') {
      grid[toRow][toCol] = { ...fromCell, revealed: true };
      grid[fromRow][fromCol] = null;
      gameOver = movingPlayerId;
      room.phase = 'GAME_OVER';
    } else if (RPS_BEATS[fromCell.type] === defender.type) {
      grid[toRow][toCol] = { ...fromCell, revealed: true };
      grid[fromRow][fromCol] = null;
      combatResult = { attackerType: fromCell.type, defenderType: defender.type, result: 'attacker_wins' };
    } else if (fromCell.type === defender.type) {
      room.phase = 'TIE_BREAKER';
      const deadline = Date.now() + TIE_BREAKER_DURATION_MS;
      const encounterId = makeBattleId('tie');
      room.tieBreaker = {
        fromRow, fromCol, toRow, toCol,
        attackerId: movingPlayerId, defenderOwnerId: defender.owner, unitType: fromCell.type,
        encounterId,
        round: 0,
        lastEmittedBattleId: null,
        isResolving: false,
        restartTimeoutId: null,
        deadline, choices: {},
        timeoutId: setTimeout(() => resolveTieBreaker(room), TIE_BREAKER_DURATION_MS),
      };
      if (room.turnTimerInterval) {
        clearInterval(room.turnTimerInterval);
        room.turnTimerInterval = null;
      }
      room.players.forEach((p) => {
        if (!p.socketId) return;
        io.to(p.socketId).emit('tie_break_start', { battleId: `${encounterId}:start:0`, deadline, unitType: fromCell.type, fromRow, fromCol, toRow, toCol });
      });
      return 'tie_breaker';
    } else {
      grid[fromRow][fromCol] = null;
      grid[toRow][toCol] = { ...grid[toRow][toCol], revealed: true };
      combatResult = { attackerType: fromCell.type, defenderType: defender.type, result: 'defender_wins' };
    }
  }

  if (!gameOver) {
    gs.currentTurn = room.players.find((p) => p.id !== movingPlayerId)?.id ?? gs.currentTurn;
    room.turnStartTime = Date.now();
    room.turnDeadline = Date.now() + TURN_TIMEOUT_SEC * 1000;
    room.players.forEach((p) => {
      const mobile = countMobileUnits(grid, p.id);
      if (mobile === 0) gameOver = room.players.find((x) => x.id !== p.id)?.id ?? null;
    });
    if (gameOver) room.phase = 'GAME_OVER';
  }

  if (combatResult) {
    const battleId = makeBattleId('combat');
    room.players.forEach((p) => {
      if (!p.socketId) return;
      const entry = sanitizeGameStateForPlayer(room.gameState, p.id);
      io.to(p.socketId).emit('combat_event', {
        battleId,
        ...combatResult,
        attackerId: movingPlayerId,
        fromRow, fromCol, toRow, toCol,
        newGameState: { ...entry, turnStartTime: room.turnStartTime },
      });
    });
  } else {
    emitGameState(room);
  }
  if (gameOver) {
    if (room.turnTimerInterval) {
      clearInterval(room.turnTimerInterval);
      room.turnTimerInterval = null;
    }
    room.rematchRequested = {};
    room.lastWinnerId = gameOver;
    room.lastFlagCapture = !combatResult;
    room.players.forEach((p) => {
      if (!p.socketId) return;
      io.to(p.socketId).emit('game_over', { winnerId: gameOver, flagCapture: !combatResult });
    });
    // Persist result for completed game
    recordGameResultForRoom(room, gameOver);
  }
  return 'ok';
}

function checkTurnTimeout(room) {
  if (room.phase !== 'PLAYING' || !room.gameState || room.tieBreaker) return;
  const deadline = room.turnDeadline ?? (room.turnStartTime || 0) + TURN_TIMEOUT_SEC * 1000;
  if (Date.now() <= deadline) return;
  const moves = getValidMovesForPlayer(room, room.gameState.currentTurn);
  if (moves.length === 0) {
    const otherId = room.players.find((p) => p.id !== room.gameState.currentTurn)?.id;
    if (otherId) {
      room.gameState.currentTurn = otherId;
      room.phase = 'GAME_OVER';
      room.turnStartTime = Date.now();
      room.turnDeadline = null;
      if (room.turnTimerInterval) {
        clearInterval(room.turnTimerInterval);
        room.turnTimerInterval = null;
      }
      room.rematchRequested = {};
      room.lastWinnerId = otherId;
      room.lastFlagCapture = false;
      room.players.forEach((p) => {
        if (!p.socketId) return;
        io.to(p.socketId).emit('game_over', { winnerId: otherId, flagCapture: false });
      });
      recordGameResultForRoom(room, otherId);
    } else {
      room.turnStartTime = Date.now();
      room.turnDeadline = Date.now() + TURN_TIMEOUT_SEC * 1000;
      emitGameState(room);
    }
    return;
  }
  const [fr, fc, tr, tc] = moves[Math.floor(Math.random() * moves.length)];
  executeMove(room, fr, fc, tr, tc, room.gameState.currentTurn);
}

function checkExpiredTurns() {
  for (const room of rooms.values()) {
    if (room.phase !== 'PLAYING' || !room.gameState || room.tieBreaker) continue;
    const deadline = room.turnDeadline ?? (room.turnStartTime || 0) + TURN_TIMEOUT_SEC * 1000;
    if (Date.now() <= deadline) continue;
    const moves = getValidMovesForPlayer(room, room.gameState.currentTurn);
    if (moves.length === 0) {
      const otherId = room.players.find((p) => p.id !== room.gameState.currentTurn)?.id;
      if (otherId) {
        room.gameState.currentTurn = otherId;
        room.phase = 'GAME_OVER';
        room.turnStartTime = Date.now();
        room.turnDeadline = null;
        if (room.turnTimerInterval) {
          clearInterval(room.turnTimerInterval);
          room.turnTimerInterval = null;
        }
        room.rematchRequested = {};
        room.lastWinnerId = otherId;
        room.lastFlagCapture = false;
        room.players.forEach((p) => {
          if (!p.socketId) return;
          io.to(p.socketId).emit('game_over', { winnerId: otherId, flagCapture: false });
        });
        recordGameResultForRoom(room, otherId);
      } else {
        room.turnStartTime = Date.now();
        room.turnDeadline = Date.now() + TURN_TIMEOUT_SEC * 1000;
        emitGameState(room);
      }
      continue;
    }
    const [fr, fc, tr, tc] = moves[Math.floor(Math.random() * moves.length)];
    executeMove(room, fr, fc, tr, tc, room.gameState.currentTurn);
  }
}

function transitionToPlaying(room) {
  if (room.setupInterval) {
    clearInterval(room.setupInterval);
    room.setupInterval = null;
  }
  room.phase = 'PLAYING';
  room.gameState = buildGameStateFromSetup(room);
  room.turnStartTime = Date.now();
  room.turnDeadline = Date.now() + TURN_TIMEOUT_SEC * 1000;
  if (room.turnTimerInterval) clearInterval(room.turnTimerInterval);
  room.turnTimerInterval = setInterval(() => {
    const r = rooms.get(room.roomId);
    if (r) checkTurnTimeout(r);
  }, 1000);
  room.players.forEach((p) => {
    if (!p.socketId) return;
    const sanitized = sanitizeGameStateForPlayer(room.gameState, p.id);
    io.to(p.socketId).emit('game_start', {
      gameState: {
        ...sanitized,
        turnStartTime: room.turnStartTime,
        players: room.players.map((x) => ({
          id: x.id,
          name: x.name,
          side: x.side,
          teamName: x.teamName,
          teamColor: x.teamColor,
        })),
      },
      phase: 'PLAYING',
    });
  });
}

const rooms = new Map();

setInterval(() => {
  checkExpiredTurns();
}, 1000);

async function recordGameResultForRoom(room, winnerId = null, explicitPlayerIds = null) {
  try {
    if (!room || room.resultPersisted) return;

    let playerIds = explicitPlayerIds;
    if (!playerIds) {
      const uniqueIds = Array.from(new Set((room.players || []).map((p) => p.id).filter((id) => id != null)));
      if (uniqueIds.length !== 2) return;
      playerIds = uniqueIds;
    }

    const [playerAId, playerBId] = playerIds;

    room.resultPersisted = true;
    await saveGameResult(playerAId, playerBId, winnerId);
  } catch (err) {
    // Do not crash the game flow if persistence fails
    console.error('Failed to record game result:', err);
  }
}

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) {
      const err = new Error('Unauthorized');
      err.data = { code: 'NO_TOKEN' };
      return next(err);
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { group: true },
    });
    if (!user) {
      const err = new Error('Unauthorized');
      err.data = { code: 'USER_NOT_FOUND' };
      return next(err);
    }

    socket.user = {
      id: user.id,
      username: user.username,
      groupId: user.groupId,
      teamName: user.group?.name || null,
      teamColor: user.group?.color || null,
      wins: user.wins ?? 0,
      losses: user.losses ?? 0,
      draws: user.draws ?? 0,
    };
    next();
  } catch (err) {
    console.error('Socket auth error:', err);
    const error = new Error('Unauthorized');
    error.data = { code: 'INVALID_TOKEN' };
    next(error);
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_room', ({ roomId }) => {
    const rid = roomId || `room-${Date.now()}`;
    let room = rooms.get(rid);
    if (!room) {
      room = {
        roomId: rid,
        players: [],
        phase: 'WAITING',
        setupInterval: null,
        resultPersisted: false,
      };
      rooms.set(rid, room);
    }

    const adapterSize = io.sockets.adapter.rooms.get(rid)?.size ?? 0;
    const mapPlayersCount = room.players?.length ?? 0;
    console.log('[join_room] roomId:', rid, 'adapter room size:', adapterSize, 'rooms Map players:', mapPlayersCount, 'room state:', JSON.stringify(room.players?.map((p) => ({ id: p.id, socketId: p.socketId }))));

    // Remove ghost players: socketId set but socket no longer connected
    const socketsMap = io.sockets.sockets;
    const beforePrune = room.players.length;
    const ghosts = room.players.filter((p) => p.socketId && !socketsMap.get(p.socketId));
    ghosts.forEach((p) => {
      if (room.disconnectTimers?.[p.id]) {
        clearTimeout(room.disconnectTimers[p.id]);
        delete room.disconnectTimers[p.id];
      }
    });
    room.players = room.players.filter((p) => {
      if (!p.socketId) return true;
      return !!socketsMap.get(p.socketId);
    });
    const removed = beforePrune - room.players.length;
    if (removed > 0) {
      if (room.players.length === 0) {
        if (room.setupInterval) clearInterval(room.setupInterval);
        if (room.turnTimerInterval) clearInterval(room.turnTimerInterval);
        if (room.tieBreaker?.timeoutId) clearTimeout(room.tieBreaker.timeoutId);
        room.disconnectTimers = {};
        rooms.delete(rid);
        room = { roomId: rid, players: [], phase: 'WAITING', setupInterval: null, resultPersisted: false };
        rooms.set(rid, room);
      }
      io.emit('room_update');
    }

    const pid = socket.user?.id || socket.id;
    const existingPlayer = room.players.find((p) => p.id === pid);

    if (existingPlayer) {
      if (existingPlayer.socketId) {
        socket.emit('room_full', { roomId: rid });
        return;
      }
      existingPlayer.socketId = socket.id;
      const player = existingPlayer;
      socket.join(rid);
      socket.roomId = rid;
      socket.playerId = pid;

      socket.emit('joined_room', {
        roomId: rid,
        playerId: pid,
        player: {
          id: pid,
          name: player.name,
          side: player.side,
          teamName: player.teamName,
          teamColor: player.teamColor,
          wins: player.wins,
          losses: player.losses,
          draws: player.draws,
        },
        players: room.players.map((p) => ({
          id: p.id,
          name: p.name,
          side: p.side,
          teamName: p.teamName,
          teamColor: p.teamColor,
          wins: p.wins,
          losses: p.losses,
          draws: p.draws,
        })),
      });
      room.players.forEach((p) => {
        if (p.socketId) io.to(p.socketId).emit('room_updated', {
          roomId: rid,
          players: room.players.map((x) => ({
            id: x.id,
            name: x.name,
            side: x.side,
            teamName: x.teamName,
            teamColor: x.teamColor,
            wins: x.wins,
            losses: x.losses,
            draws: x.draws,
          })),
        });
      });
      if (room.phase === 'SETUP') {
        const gridForPlayer = room.setupGrid?.map((row) => row.map((c) => (c && c.owner === pid ? { ...c } : null))) ?? createEmptyGrid();
        socket.emit('setup_start', {
          phase: 'SETUP',
          roomId: rid,
          players: room.players.map((x) => ({
            id: x.id,
            name: x.name,
            side: x.side,
            teamName: x.teamName,
            teamColor: x.teamColor,
          })),
          grid: gridForPlayer,
          setupReady: room.setupReady ?? {},
        });
        const remaining = Math.max(0, Math.ceil((room.setupTimerEnd - Date.now()) / 1000));
        socket.emit('setup_timer', { remaining });
      } else if (room.phase === 'PLAYING' && room.gameState) {
        const sanitized = sanitizeGameStateForPlayer(room.gameState, pid);
        socket.emit('game_start', { gameState: { ...sanitized, turnStartTime: room.turnStartTime }, phase: 'PLAYING' });
      } else if (room.phase === 'TIE_BREAKER' && room.tieBreaker) {
        const sanitized = sanitizeGameStateForPlayer(room.gameState, pid);
        socket.emit('game_state_update', { gameState: sanitized });
        socket.emit('tie_break_start', {
          deadline: room.tieBreaker.deadline,
          unitType: room.tieBreaker.unitType || 'rock',
          fromRow: room.tieBreaker.fromRow, fromCol: room.tieBreaker.fromCol,
          toRow: room.tieBreaker.toRow, toCol: room.tieBreaker.toCol,
        });
      } else if (room.phase === 'GAME_OVER' && room.lastWinnerId != null) {
        socket.emit('game_over', { winnerId: room.lastWinnerId, flagCapture: !!room.lastFlagCapture });
        socket.emit('rematch_update', { rematchRequested: room.rematchRequested ?? {} });
      }
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('room_full', { roomId: rid });
      return;
    }

    const playerName = socket.user?.username || `Player ${room.players.length + 1}`;
    const teamName = socket.user?.teamName || null;
    const teamColor = socket.user?.teamColor || null;
    const wins = socket.user?.wins ?? 0;
    const losses = socket.user?.losses ?? 0;
    const draws = socket.user?.draws ?? 0;

    const player = {
      id: pid,
      socketId: socket.id,
      name: playerName,
      side: room.players.length === 0 ? 'bottom' : 'top',
      teamName,
      teamColor,
      wins,
      losses,
      draws,
    };
    room.players.push(player);

    socket.join(rid);
    socket.roomId = rid;
    socket.playerId = pid;

    socket.emit('joined_room', {
      roomId: rid,
      playerId: pid,
      player: {
        id: pid,
        name: player.name,
        side: player.side,
        teamName: player.teamName,
        teamColor: player.teamColor,
        wins: player.wins,
        losses: player.losses,
        draws: player.draws,
      },
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        side: p.side,
        teamName: p.teamName,
        teamColor: p.teamColor,
        wins: p.wins,
        losses: p.losses,
        draws: p.draws,
      })),
    });
    room.players.forEach((p) => {
      if (p.socketId) io.to(p.socketId).emit('room_updated', {
        roomId: rid,
        players: room.players.map((x) => ({
          id: x.id,
          name: x.name,
          side: x.side,
          teamName: x.teamName,
          teamColor: x.teamColor,
          wins: x.wins,
          losses: x.losses,
          draws: x.draws,
        })),
      });
    });

    if (room.players.length === 2) {
      startSetupPhase(room);
    }
  });

  socket.on('request_game_state', () => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (!room) return;

    if (room.phase === 'SETUP') {
      const gridForPlayer = room.setupGrid
        ? room.setupGrid.map((row) => row.map((c) => (c && c.owner === socket.playerId ? { ...c } : null)))
        : createEmptyGrid();
      socket.emit('setup_start', {
        phase: 'SETUP',
        roomId: room.roomId,
        players: room.players.map((x) => ({
          id: x.id,
          name: x.name,
          side: x.side,
          teamName: x.teamName,
          teamColor: x.teamColor,
          wins: x.wins,
          losses: x.losses,
          draws: x.draws,
        })),
        grid: gridForPlayer,
        setupReady: room.setupReady ?? {},
      });
      const remaining = Math.max(0, Math.ceil((room.setupTimerEnd - Date.now()) / 1000));
      socket.emit('setup_timer', { remaining });
      return;
    }

    if (room.phase === 'PLAYING' && room.gameState) {
      const sanitized = sanitizeGameStateForPlayer(room.gameState, socket.playerId);
      socket.emit('game_start', {
        gameState: { ...sanitized, turnStartTime: room.turnStartTime },
        phase: 'PLAYING',
      });
    }

    if (room.phase === 'TIE_BREAKER' && room.tieBreaker) {
      const sanitized = sanitizeGameStateForPlayer(room.gameState, socket.playerId);
      socket.emit('game_state_update', { gameState: { ...sanitized, turnStartTime: room.turnStartTime } });
      socket.emit('tie_break_start', {
        deadline: room.tieBreaker.deadline,
        unitType: room.tieBreaker.unitType || 'rock',
        fromRow: room.tieBreaker.fromRow, fromCol: room.tieBreaker.fromCol,
        toRow: room.tieBreaker.toRow, toCol: room.tieBreaker.toCol,
      });
    }
  });

  socket.on('place_unit', ({ row, col, type }) => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (!room || room.phase !== 'SETUP') return;

    const player = room.players.find((p) => p.id === socket.playerId);
    if (!player) return;

    const slots = getPlayerSetupSlots(player.side);
    const isValidCell = slots.some(([r, c]) => r === row && c === col);
    if (!isValidCell || room.setupGrid[row][col]) return;

    const placed = countPlacedForPlayer(room.setupGrid, socket.playerId, player.side);
    const total = placed.rock + placed.paper + placed.scissors + placed.flag + placed.trap;
    if (total >= 12) return;

    if (type === 'flag' && placed.flag >= 1) return;
    if (type === 'trap' && placed.trap >= 1) return;
    const rpsTotal = placed.rock + placed.paper + placed.scissors;
    if (['rock', 'paper', 'scissors'].includes(type) && rpsTotal >= 10) return;

    room.setupGrid[row][col] = {
      type,
      id: `${player.side}-${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      owner: socket.playerId,
      ownerSide: player.side,
      revealed: false,
    };

    room.players.forEach((p) => {
      if (!p.socketId) return;
      const gridForPlayer = room.setupGrid.map((row) =>
        row.map((c) => (c && c.owner === p.id ? { ...c } : null))
      );
      io.to(p.socketId).emit('setup_update', {
        grid: gridForPlayer,
        setupReady: room.setupReady,
      });
    });
  });

  socket.on('remove_unit', ({ row, col }) => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (!room || room.phase !== 'SETUP') return;

    const player = room.players.find((p) => p.id === socket.playerId);
    if (!player) return;

    const slots = getPlayerSetupSlots(player.side);
    const isMyCell = slots.some(([r, c]) => r === row && c === col);
    if (!isMyCell || !room.setupGrid[row][col] || room.setupGrid[row][col].owner !== socket.playerId) return;

    room.setupGrid[row][col] = null;

    room.players.forEach((p) => {
      if (!p.socketId) return;
      const gridForPlayer = room.setupGrid.map((row) =>
        row.map((c) => (c && c.owner === p.id ? { ...c } : null))
      );
      io.to(p.socketId).emit('setup_update', {
        grid: gridForPlayer,
        setupReady: room.setupReady,
      });
    });
  });

  socket.on('randomize_setup', () => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (!room || room.phase !== 'SETUP') return;

    smartFillEmptySlots(room, socket.playerId);

    room.players.forEach((p) => {
      if (!p.socketId) return;
      const gridForPlayer = room.setupGrid.map((row) =>
        row.map((c) => (c && c.owner === p.id ? { ...c } : null))
      );
      io.to(p.socketId).emit('setup_update', {
        grid: gridForPlayer,
        setupReady: room.setupReady,
      });
    });
  });

  socket.on('setup_ready', () => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (!room || room.phase !== 'SETUP') return;

    const player = room.players.find((p) => p.id === socket.playerId);
    if (!player) return;
    const placed = countPlacedForPlayer(room.setupGrid, socket.playerId, player.side);
    const total = placed.rock + placed.paper + placed.scissors + placed.flag + placed.trap;
    if (total !== 12 || placed.flag !== 1 || placed.trap !== 1) return;

    room.setupReady[socket.playerId] = true;
    room.players.forEach((p) => {
      if (!p.socketId) return;
      const gridForPlayer = room.setupGrid.map((row) =>
        row.map((c) => (c && c.owner === p.id ? { ...c } : null))
      );
      io.to(p.socketId).emit('setup_update', {
        grid: gridForPlayer,
        setupReady: room.setupReady,
      });
    });

    if (room.players.every((p) => room.setupReady[p.id])) {
      transitionToPlaying(room);
    }
  });

  socket.on('make_move', ({ fromRow, fromCol, toRow, toCol }) => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (!room?.gameState || room.phase !== 'PLAYING') return;

    const gs = room.gameState;
    const grid = gs.grid;

    if (gs.currentTurn !== socket.playerId) return;

    const fromCell = grid[fromRow]?.[fromCol];
    if (!fromCell || fromCell.owner !== socket.playerId) return;
    if (IMMOBILE_TYPES.includes(fromCell.type)) return;

    const adj = getAdjacentCells(fromRow, fromCol);
    if (!adj.some(([r, c]) => r === toRow && c === toCol)) return;

    const toCell = grid[toRow][toCol];
    const isToEmpty = !toCell;
    const isToEnemy = toCell && toCell.owner !== socket.playerId;
    if (!isToEmpty && !isToEnemy) return;

    executeMove(room, fromRow, fromCol, toRow, toCol, socket.playerId);
  });

  socket.on('request_rematch', () => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (!room || room.phase !== 'GAME_OVER') return;
    if (!room.rematchRequested) room.rematchRequested = {};
    room.rematchRequested[socket.playerId] = true;
    const connectedPlayers = room.players.filter((p) => p.socketId);
    const bothRequested = connectedPlayers.every((p) => room.rematchRequested[p.id]);
    room.players.forEach((p) => {
      if (!p.socketId) return;
      io.to(p.socketId).emit('rematch_update', { rematchRequested: { ...room.rematchRequested } });
    });
    if (bothRequested && connectedPlayers.length === 2) {
      startSetupPhase(room);
    }
  });

  socket.on('submit_tie_choice', ({ choice }) => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (!room || room.phase !== 'TIE_BREAKER' || !room.tieBreaker) return;
    if (!['rock', 'paper', 'scissors'].includes(choice)) return;

    const tb = room.tieBreaker;
    if (socket.playerId !== tb.attackerId && socket.playerId !== tb.defenderOwnerId) return;

    tb.choices[socket.playerId] = choice;
    const bothSubmitted =
      tb.choices[tb.attackerId] != null && tb.choices[tb.defenderOwnerId] != null;
    if (bothSubmitted) resolveTieBreaker(room);
  });

  socket.on('send_emoji', ({ emoji }) => {
    if (!socket.roomId || !emoji) return;
    const room = rooms.get(socket.roomId);
    if (!room) return;
    const fromPlayerId = socket.playerId;
    if (!fromPlayerId) return;
    room.players.forEach((p) => {
      if (!p.socketId) return;
      io.to(p.socketId).emit('emoji_reaction', {
        fromPlayerId,
        emoji: String(emoji).slice(0, 8), // tiny safety guard
      });
    });
  });

  socket.on('leave_room', () => {
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        if (room.setupInterval) clearInterval(room.setupInterval);
        if (room.tieBreaker?.timeoutId) clearTimeout(room.tieBreaker.timeoutId);
        const leaverId = socket.playerId;
        const previousPlayers = [...room.players];
        room.players = room.players.filter((p) => p.id !== leaverId);
        const remaining = room.players[0];
        if (!remaining) {
          rooms.delete(socket.roomId);
        } else {
          // Treat as win for remaining player if a game was in progress or setup was ready.
          room.phase = 'GAME_OVER';
          room.rematchRequested = {};
          room.lastWinnerId = remaining.id;
          room.lastFlagCapture = false;
          if (room.turnTimerInterval) {
            clearInterval(room.turnTimerInterval);
            room.turnTimerInterval = null;
          }
          io.to(remaining.socketId).emit('game_over', { winnerId: remaining.id, flagCapture: false, disconnectWin: true });
          const explicitIds = previousPlayers.map((p) => p.id).filter((id) => id != null);
          if (explicitIds.length === 2) {
            recordGameResultForRoom(room, remaining.id, explicitIds);
          }
        }
      }
      socket.leave(socket.roomId);
      socket.roomId = null;
    }
  });

  socket.on('disconnect', () => {
    const leftRoomId = socket.roomId;
    const leftPlayerId = socket.playerId;
    socket.roomId = null;
    socket.playerId = null;

    if (leftRoomId && leftPlayerId) {
      const room = rooms.get(leftRoomId);
      if (room) {
        const player = room.players.find((p) => p.id === leftPlayerId);
        if (player) {
          player.socketId = null;
          if (!room.disconnectTimers) room.disconnectTimers = {};
          if (room.disconnectTimers[player.id]) {
            clearTimeout(room.disconnectTimers[player.id]);
          }
          room.disconnectTimers[player.id] = setTimeout(() => {
            const r = rooms.get(leftRoomId);
            if (!r) return;
            const still = r.players.find((p) => p.id === leftPlayerId);
            if (!still || still.socketId) return;

            r.players = r.players.filter((p) => p.id !== leftPlayerId);
            delete r.disconnectTimers?.[leftPlayerId];

            if (r.players.length === 0) {
              if (r.setupInterval) clearInterval(r.setupInterval);
              if (r.turnTimerInterval) clearInterval(r.turnTimerInterval);
              if (r.tieBreaker?.timeoutId) clearTimeout(r.tieBreaker.timeoutId);
              r.disconnectTimers = {};
              rooms.delete(r.roomId);
              io.emit('room_update');
              return;
            }

            const remaining = r.players[0];
            r.phase = 'GAME_OVER';
            r.rematchRequested = {};
            r.lastWinnerId = remaining.id;
            r.lastFlagCapture = false;
            if (r.turnTimerInterval) {
              clearInterval(r.turnTimerInterval);
              r.turnTimerInterval = null;
            }
            r.players.forEach((q) => {
              if (!q.socketId) return;
              io.to(q.socketId).emit('room_updated', { roomId: r.roomId, players: r.players.map((x) => ({ id: x.id, name: x.name, side: x.side })) });
              io.to(q.socketId).emit('game_over', { winnerId: remaining.id, flagCapture: false, disconnectWin: true });
            });
            const explicitIds = [leftPlayerId, remaining.id].filter((id) => id != null);
            if (explicitIds.length === 2) {
              recordGameResultForRoom(r, remaining.id, explicitIds);
            }
            io.emit('room_update');
          }, DISCONNECT_GRACE_MS);
        }
      }
    }
    console.log('Client disconnected:', socket.id, 'roomId:', leftRoomId, 'playerId:', leftPlayerId);
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok', rooms: rooms.size }));

app.post('/auth/register', async (req, res) => {
  try {
    const { username, password, groupId, groupName } = req.body || {};
    let finalGroupName = groupName || null;

    if (!finalGroupName && groupId != null) {
      const group = await prisma.group.findUnique({
        where: { id: Number(groupId) },
        select: { name: true },
      });
      if (!group) {
        return res.status(400).json({ error: 'Invalid groupId' });
      }
      finalGroupName = group.name;
    }

    const result = await registerUser(username, password, finalGroupName);
    res.json(result);
  } catch (err) {
    console.error('Error in /auth/register', err);
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const result = await loginUser(username, password);
    res.json(result);
  } catch (err) {
    console.error('Error in /auth/login', err);
    res.status(400).json({ error: err.message || 'Login failed' });
  }
});

app.get('/auth/groups', async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
      },
    });
    res.json(groups);
  } catch (err) {
    console.error('Error fetching groups', err);
    res.status(500).json({ error: 'Failed to load groups' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const topPlayers = await prisma.user.findMany({
      orderBy: { wins: 'desc' },
      take: 10,
      select: {
        id: true,
        username: true,
        wins: true,
        losses: true,
        group: {
          select: { id: true, name: true, color: true, totalWins: true, totalLosses: true },
        },
      },
    });

    const topGroups = await prisma.group.findMany({
      orderBy: { totalWins: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        color: true,
        totalWins: true,
        totalLosses: true,
      },
    });

    res.json({ players: topPlayers, groups: topGroups });
  } catch (err) {
    console.error('Error building leaderboard', err);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

app.get('/api/rooms/active', (req, res) => {
  try {
    const activeRooms = [];
    rooms.forEach((room) => {
      if (!room || (room.phase !== 'WAITING' && room.phase !== 'SETUP')) return;
      const host = (room.players || [])[0];
      if (!host) return;
      activeRooms.push({
        roomId: room.roomId,
        phase: room.phase,
        playerName: host.name,
        teamName: host.teamName,
        teamColor: host.teamColor,
        playersCount: room.players.length,
      });
    });
    res.json(activeRooms);
  } catch (err) {
    console.error('Error listing active rooms', err);
    res.status(500).json({ error: 'Failed to load active rooms' });
  }
});

app.get('/api/stats/players', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        wins: true,
        losses: true,
        group: { select: { name: true, color: true } },
      },
      orderBy: { wins: 'desc' },
    });

    const enriched = users
      .map((u) => {
        const gamesPlayed = u.wins + u.losses;
        const winPercentage = gamesPlayed > 0 ? Number(((u.wins / gamesPlayed) * 100).toFixed(2)) : 0;
        const isRanked = gamesPlayed >= 8;
        return {
          id: u.id,
          username: u.username,
          groupName: u.group?.name ?? null,
          groupColor: u.group?.color ?? null,
          wins: u.wins,
          losses: u.losses,
          gamesPlayed,
          winPercentage,
          isRanked,
        };
      })
      .filter((u) => u.gamesPlayed > 0)
      .sort((a, b) => {
        if (a.isRanked !== b.isRanked) return b.isRanked ? 1 : -1;
        if (b.winPercentage !== a.winPercentage) return b.winPercentage - a.winPercentage;
        return b.wins - a.wins;
      });

    res.json(enriched);
  } catch (err) {
    console.error('Error building player stats', err);
    res.status(500).json({ error: 'Failed to load player stats' });
  }
});

app.get('/api/stats/groups', async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        totalWins: true,
        totalLosses: true,
      },
    });

    const enriched = groups
      .map((g) => {
        const gamesPlayed = g.totalWins + g.totalLosses;
        const winPercentage = gamesPlayed > 0 ? Number(((g.totalWins / gamesPlayed) * 100).toFixed(2)) : 0;
        const isRanked = gamesPlayed >= 8;
        return {
          id: g.id,
          name: g.name,
          color: g.color,
          wins: g.totalWins,
          losses: g.totalLosses,
          gamesPlayed,
          winPercentage,
          isRanked,
        };
      })
      .filter((g) => g.gamesPlayed > 0)
      .sort((a, b) => {
        if (a.isRanked !== b.isRanked) return b.isRanked ? 1 : -1;
        if (b.winPercentage !== a.winPercentage) return b.winPercentage - a.winPercentage;
        return b.wins - a.wins;
      });

    res.json(enriched);
  } catch (err) {
    console.error('Error building group stats', err);
    res.status(500).json({ error: 'Failed to load group stats' });
  }
});

// Simple JWT auth helper for HTTP routes (reuses same secret as sockets)
function getUserIdFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  const [, token] = authHeader.split(' ');
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.sub ?? null;
  } catch {
    return null;
  }
}

app.get('/api/stats/me', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [user, stats] = await Promise.all([
      prisma.user.findUnique({
        where: { id: Number(userId) },
        select: {
          id: true,
          username: true,
          wins: true,
          losses: true,
          group: { select: { id: true, name: true, color: true } },
        },
      }),
      getUserStats(userId),
    ]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user, stats });
  } catch (err) {
    console.error('Error building user stats', err);
    res.status(500).json({ error: 'Failed to load user stats' });
  }
});

app.get('/api/stats/headtohead', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const summary = await getHeadToHeadSummaryForUser(userId);
    res.json(summary);
  } catch (err) {
    console.error('Error building head-to-head stats', err);
    res.status(500).json({ error: 'Failed to load head-to-head stats' });
  }
});

const clientDist = path.join(__dirname, '../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/socket.io') || req.path === '/health') return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
