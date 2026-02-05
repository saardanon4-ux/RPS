import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const corsOrigins = CLIENT_URL.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (corsOrigins.length === 0) corsOrigins.push('http://localhost:5173');
// In dev, also allow common local variants
const devOrigins = ['http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'];
const allowedOrigins = [...new Set([...corsOrigins, ...devOrigins])];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
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
  if (tb.timeoutId) clearTimeout(tb.timeoutId);

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
    const tieCombatResult = { attackerType: choice1, defenderType: choice2, result: 'both_destroyed' };
    room.players.forEach((p) => {
      if (!p.socketId) return;
      const entry = sanitizeGameStateForPlayer(room.gameState, p.id);
      io.to(p.socketId).emit('tie_break_tie', {
        combatResult: tieCombatResult,
        attackerId,
        fromRow: tb.fromRow, fromCol: tb.fromCol, toRow: tb.toRow, toCol: tb.toCol,
        newGameState: entry,
      });
    });
    tb.choices = {};
    tb.deadline = Date.now() + TIE_BREAKER_DURATION_MS;
    tb.timeoutId = setTimeout(() => resolveTieBreaker(room), TIE_BREAKER_DURATION_MS + 3200);
    setTimeout(() => {
      if (!room.tieBreaker) return;
      room.players.forEach((p) => {
        if (!p.socketId) return;
        io.to(p.socketId).emit('tie_break_restart', {
          deadline: tb.deadline,
          fromRow: tb.fromRow, fromCol: tb.fromCol, toRow: tb.toRow, toCol: tb.toCol,
        });
      });
    }, 2800);
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
  }
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
  shuffle(toPlace);
  for (let i = 0; i < totalEmpty && i < toPlace.length; i++) {
    const [r, c] = emptySlots[i];
    const type = toPlace[i];
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

  const playersPayload = room.players.map((p) => ({ id: p.id, name: p.name, side: p.side }));
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
      room.tieBreaker = {
        fromRow, fromCol, toRow, toCol,
        attackerId: movingPlayerId, defenderOwnerId: defender.owner, unitType: fromCell.type,
        deadline, choices: {},
        timeoutId: setTimeout(() => resolveTieBreaker(room), TIE_BREAKER_DURATION_MS),
      };
      if (room.turnTimerInterval) {
        clearInterval(room.turnTimerInterval);
        room.turnTimerInterval = null;
      }
      room.players.forEach((p) => {
        if (!p.socketId) return;
        io.to(p.socketId).emit('tie_break_start', { deadline, unitType: fromCell.type, fromRow, fromCol, toRow, toCol });
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
    room.players.forEach((p) => {
      const mobile = countMobileUnits(grid, p.id);
      if (mobile === 0) gameOver = room.players.find((x) => x.id !== p.id)?.id ?? null;
    });
    if (gameOver) room.phase = 'GAME_OVER';
  }

  if (combatResult) {
    room.players.forEach((p) => {
      if (!p.socketId) return;
      const entry = sanitizeGameStateForPlayer(room.gameState, p.id);
      io.to(p.socketId).emit('combat_event', {
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
  }
  return 'ok';
}

function checkTurnTimeout(room) {
  if (room.phase !== 'PLAYING' || !room.gameState || room.tieBreaker) return;
  const elapsed = (Date.now() - (room.turnStartTime || 0)) / 1000;
  if (elapsed < TURN_TIMEOUT_SEC) return;
  const moves = getValidMovesForPlayer(room, room.gameState.currentTurn);
  if (moves.length === 0) {
    room.gameState.currentTurn = room.players.find((p) => p.id !== room.gameState.currentTurn)?.id;
    room.turnStartTime = Date.now();
    emitGameState(room);
    return;
  }
  const [fr, fc, tr, tc] = moves[Math.floor(Math.random() * moves.length)];
  executeMove(room, fr, fc, tr, tc, room.gameState.currentTurn);
}

function transitionToPlaying(room) {
  if (room.setupInterval) {
    clearInterval(room.setupInterval);
    room.setupInterval = null;
  }
  room.phase = 'PLAYING';
  room.gameState = buildGameStateFromSetup(room);
  room.turnStartTime = Date.now();
  if (room.turnTimerInterval) clearInterval(room.turnTimerInterval);
  room.turnTimerInterval = setInterval(() => {
    const r = rooms.get(room.roomId);
    if (r) checkTurnTimeout(r);
  }, 1000);
  room.players.forEach((p) => {
    if (!p.socketId) return;
    const sanitized = sanitizeGameStateForPlayer(room.gameState, p.id);
    io.to(p.socketId).emit('game_start', { gameState: { ...sanitized, turnStartTime: room.turnStartTime }, phase: 'PLAYING' });
  });
}

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_room', ({ roomId, playerName, persistentPlayerId }) => {
    const rid = roomId || `room-${Date.now()}`;
    let room = rooms.get(rid);
    if (!room) {
      room = { roomId: rid, players: [], phase: 'WAITING', setupInterval: null };
      rooms.set(rid, room);
    }

    const pid = persistentPlayerId || socket.id;
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
        player: { id: pid, name: player.name, side: player.side },
        players: room.players.map((p) => ({ id: p.id, name: p.name, side: p.side })),
      });
      room.players.forEach((p) => {
        if (p.socketId) io.to(p.socketId).emit('room_updated', { roomId: rid, players: room.players.map((x) => ({ id: x.id, name: x.name, side: x.side })) });
      });
      if (room.phase === 'SETUP') {
        const gridForPlayer = room.setupGrid?.map((row) => row.map((c) => (c && c.owner === pid ? { ...c } : null))) ?? createEmptyGrid();
        socket.emit('setup_start', {
          phase: 'SETUP',
          roomId: rid,
          players: room.players.map((x) => ({ id: x.id, name: x.name, side: x.side })),
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

    const player = {
      id: pid,
      socketId: socket.id,
      name: playerName || `Player ${room.players.length + 1}`,
      side: room.players.length === 0 ? 'bottom' : 'top',
    };
    room.players.push(player);

    socket.join(rid);
    socket.roomId = rid;
    socket.playerId = pid;

    socket.emit('joined_room', {
      roomId: rid,
      playerId: pid,
      player: { id: pid, name: player.name, side: player.side },
      players: room.players.map((p) => ({ id: p.id, name: p.name, side: p.side })),
    });
    room.players.forEach((p) => {
      if (p.socketId) io.to(p.socketId).emit('room_updated', { roomId: rid, players: room.players.map((x) => ({ id: x.id, name: x.name, side: x.side })) });
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
        players: room.players.map((x) => ({ id: x.id, name: x.name, side: x.side })),
        grid: gridForPlayer,
        setupReady: room.setupReady ?? {},
      });
      const remaining = Math.max(0, Math.ceil((room.setupTimerEnd - Date.now()) / 1000));
      socket.emit('setup_timer', { remaining });
      return;
    }

    if (room.phase === 'PLAYING' && room.gameState) {
      const sanitized = sanitizeGameStateForPlayer(room.gameState, socket.playerId);
      socket.emit('game_start', { gameState: { ...sanitized, turnStartTime: room.turnStartTime }, phase: 'PLAYING' });
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

  socket.on('leave_room', () => {
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        if (room.setupInterval) clearInterval(room.setupInterval);
        if (room.tieBreaker?.timeoutId) clearTimeout(room.tieBreaker.timeoutId);
        room.players = room.players.filter((p) => p.id !== socket.playerId);
        if (room.players.length === 0) rooms.delete(socket.roomId);
        else io.to(socket.roomId).emit('room_updated', { roomId: socket.roomId, players: room.players.map((x) => ({ id: x.id, name: x.name, side: x.side })) });
      }
      socket.leave(socket.roomId);
      socket.roomId = null;
    }
  });

  socket.on('disconnect', () => {
    if (socket.roomId && socket.playerId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        const p = room.players.find((x) => x.id === socket.playerId);
        if (p) {
          p.socketId = null;
          room.players.forEach((q) => {
            if (q.socketId) io.to(q.socketId).emit('room_updated', { roomId: socket.roomId, players: room.players.map((x) => ({ id: x.id, name: x.name, side: x.side })) });
          });
        }
      }
    }
    console.log('Client disconnected:', socket.id);
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok', rooms: rooms.size }));

const clientDist = path.join(__dirname, '../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/socket.io') || req.path === '/health') return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
