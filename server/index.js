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
const SETUP_DURATION_SEC = 30;
const TIE_BREAKER_DURATION_MS = 3000;

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
  room.players.forEach((p) => {
    const sanitized = sanitizeGameStateForPlayer(room.gameState, p.id);
    io.to(p.id).emit('game_state_update', { gameState: sanitized });
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
    // Another tie - restart
    tb.choices = {};
    tb.deadline = Date.now() + TIE_BREAKER_DURATION_MS;
    tb.timeoutId = setTimeout(() => resolveTieBreaker(room), TIE_BREAKER_DURATION_MS);
    room.players.forEach((p) =>
      io.to(p.id).emit('tie_break_restart', { deadline: tb.deadline })
    );
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
    const entry = sanitizeGameStateForPlayer(room.gameState, p.id);
    io.to(p.id).emit('tie_break_resolved', { combatResult, attackerId, newGameState: entry });
  });
  if (gameOver) {
    room.players.forEach((p) =>
      io.to(p.id).emit('game_over', { winnerId: gameOver, flagCapture: false })
    );
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
  const emptySlots = slots.filter(([r, c]) => !room.setupGrid[r][c]);
  const placed = countPlacedForPlayer(room.setupGrid, playerId, player.side);
  const needFlag = 1 - placed.flag;
  const needTrap = 1 - placed.trap;
  const needRPS = 10 - placed.rock - placed.paper - placed.scissors;
  const toPlace = [];
  for (let i = 0; i < needFlag; i++) toPlace.push('flag');
  for (let i = 0; i < needTrap; i++) toPlace.push('trap');
  const rpsCount = Math.max(0, Math.min(needRPS, emptySlots.length - toPlace.length));
  const rockCount = Math.ceil(rpsCount / 3);
  const paperCount = Math.ceil((rpsCount - rockCount) / 2);
  const scissorsCount = rpsCount - rockCount - paperCount;
  for (let i = 0; i < rockCount; i++) toPlace.push('rock');
  for (let i = 0; i < paperCount; i++) toPlace.push('paper');
  for (let i = 0; i < scissorsCount; i++) toPlace.push('scissors');
  shuffle(toPlace);
  let idx = 0;
  emptySlots.forEach(([r, c]) => {
    if (idx >= toPlace.length) return;
    const type = toPlace[idx++];
    room.setupGrid[r][c] = {
      type,
      id: `${player.side}-${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      owner: playerId,
      ownerSide: player.side,
      revealed: false,
    };
  });
}

function startSetupPhase(room) {
  room.phase = 'SETUP';
  room.setupGrid = createEmptyGrid();
  room.setupReady = {};
  room.setupTimerEnd = Date.now() + SETUP_DURATION_SEC * 1000;

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

  room.players.forEach((p) => {
    const gridForPlayer = room.setupGrid.map((row) =>
      row.map((c) => (c && c.owner === p.id ? { ...c } : null))
    );
    io.to(p.id).emit('setup_start', {
      phase: 'SETUP',
      grid: gridForPlayer,
      setupReady: room.setupReady,
    });
  });
}

function transitionToPlaying(room) {
  if (room.setupInterval) {
    clearInterval(room.setupInterval);
    room.setupInterval = null;
  }
  room.phase = 'PLAYING';
  room.gameState = buildGameStateFromSetup(room);
  room.players.forEach((p) => {
    const sanitized = sanitizeGameStateForPlayer(room.gameState, p.id);
    io.to(p.id).emit('game_start', { gameState: sanitized, phase: 'PLAYING' });
  });
}

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_room', ({ roomId, playerName }) => {
    const rid = roomId || `room-${Date.now()}`;
    let room = rooms.get(rid);
    if (!room) {
      room = { roomId: rid, players: [], phase: 'WAITING', setupInterval: null };
      rooms.set(rid, room);
    }

    if (room.players.length >= 2) {
      socket.emit('room_full', { roomId: rid });
      return;
    }

    const player = {
      id: socket.id,
      name: playerName || `Player ${room.players.length + 1}`,
      side: room.players.length === 0 ? 'bottom' : 'top',
    };
    room.players.push(player);

    socket.join(rid);
    socket.roomId = rid;
    socket.playerId = socket.id;

    socket.emit('joined_room', {
      roomId: rid,
      playerId: socket.id,
      player,
      players: room.players,
    });
    io.to(rid).emit('room_updated', { roomId: rid, players: room.players });

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
        ? room.setupGrid.map((row) => row.map((c) => (c && c.owner === socket.id ? { ...c } : null)))
        : createEmptyGrid();
      socket.emit('setup_start', {
        phase: 'SETUP',
        grid: gridForPlayer,
        setupReady: room.setupReady ?? {},
      });
      const remaining = Math.max(0, Math.ceil((room.setupTimerEnd - Date.now()) / 1000));
      socket.emit('setup_timer', { remaining });
      return;
    }

    if (room.phase === 'PLAYING' && room.gameState) {
      const sanitized = sanitizeGameStateForPlayer(room.gameState, socket.id);
      socket.emit('game_start', { gameState: sanitized, phase: 'PLAYING' });
    }

    if (room.phase === 'TIE_BREAKER' && room.tieBreaker) {
      const sanitized = sanitizeGameStateForPlayer(room.gameState, socket.id);
      socket.emit('game_state_update', { gameState: sanitized });
      socket.emit('tie_break_start', {
        deadline: room.tieBreaker.deadline,
        unitType: room.tieBreaker.unitType || 'rock',
      });
    }
  });

  socket.on('place_unit', ({ row, col, type }) => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (!room || room.phase !== 'SETUP') return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    const slots = getPlayerSetupSlots(player.side);
    const isValidCell = slots.some(([r, c]) => r === row && c === col);
    if (!isValidCell || room.setupGrid[row][col]) return;

    const placed = countPlacedForPlayer(room.setupGrid, socket.id, player.side);
    const total = placed.rock + placed.paper + placed.scissors + placed.flag + placed.trap;
    if (total >= 12) return;

    if (type === 'flag' && placed.flag >= 1) return;
    if (type === 'trap' && placed.trap >= 1) return;
    const rpsTotal = placed.rock + placed.paper + placed.scissors;
    if (['rock', 'paper', 'scissors'].includes(type) && rpsTotal >= 10) return;

    room.setupGrid[row][col] = {
      type,
      id: `${player.side}-${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      owner: socket.id,
      ownerSide: player.side,
      revealed: false,
    };

    room.players.forEach((p) => {
      const gridForPlayer = room.setupGrid.map((row) =>
        row.map((c) => (c && c.owner === p.id ? { ...c } : null))
      );
      io.to(p.id).emit('setup_update', {
        grid: gridForPlayer,
        setupReady: room.setupReady,
      });
    });
  });

  socket.on('remove_unit', ({ row, col }) => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (!room || room.phase !== 'SETUP') return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    const slots = getPlayerSetupSlots(player.side);
    const isMyCell = slots.some(([r, c]) => r === row && c === col);
    if (!isMyCell || !room.setupGrid[row][col] || room.setupGrid[row][col].owner !== socket.id) return;

    room.setupGrid[row][col] = null;

    room.players.forEach((p) => {
      const gridForPlayer = room.setupGrid.map((row) =>
        row.map((c) => (c && c.owner === p.id ? { ...c } : null))
      );
      io.to(p.id).emit('setup_update', {
        grid: gridForPlayer,
        setupReady: room.setupReady,
      });
    });
  });

  socket.on('randomize_setup', () => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (!room || room.phase !== 'SETUP') return;

    smartFillEmptySlots(room, socket.id);

    room.players.forEach((p) => {
      const gridForPlayer = room.setupGrid.map((row) =>
        row.map((c) => (c && c.owner === p.id ? { ...c } : null))
      );
      io.to(p.id).emit('setup_update', {
        grid: gridForPlayer,
        setupReady: room.setupReady,
      });
    });
  });

  socket.on('setup_ready', () => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (!room || room.phase !== 'SETUP') return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;
    const placed = countPlacedForPlayer(room.setupGrid, socket.id, player.side);
    const total = placed.rock + placed.paper + placed.scissors + placed.flag + placed.trap;
    if (total !== 12 || placed.flag !== 1 || placed.trap !== 1) return;

    room.setupReady[socket.id] = true;
    room.players.forEach((p) => {
      const gridForPlayer = room.setupGrid.map((row) =>
        row.map((c) => (c && c.owner === p.id ? { ...c } : null))
      );
      io.to(p.id).emit('setup_update', {
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

    if (gs.currentTurn !== socket.id) return;

    const fromCell = grid[fromRow]?.[fromCol];
    if (!fromCell || fromCell.owner !== socket.id) return;
    if (IMMOBILE_TYPES.includes(fromCell.type)) return;

    const adj = getAdjacentCells(fromRow, fromCol);
    if (!adj.some(([r, c]) => r === toRow && c === toCol)) return;

    const toCell = grid[toRow][toCol];
    const isToEmpty = !toCell;
    const isToEnemy = toCell && toCell.owner !== socket.id;
    if (!isToEmpty && !isToEnemy) return;

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
        gameOver = socket.id;
        room.phase = 'GAME_OVER';
        // No combat — flag capture is a simple takeover, not a fight
      } else if (RPS_BEATS[fromCell.type] === defender.type) {
        grid[toRow][toCol] = { ...fromCell, revealed: true };
        grid[fromRow][fromCol] = null;
        combatResult = { attackerType: fromCell.type, defenderType: defender.type, result: 'attacker_wins' };
      } else if (fromCell.type === defender.type) {
        // Sudden Death Tie-Breaker: don't destroy, start tie-breaker
        room.phase = 'TIE_BREAKER';
        const deadline = Date.now() + TIE_BREAKER_DURATION_MS;
        room.tieBreaker = {
          fromRow,
          fromCol,
          toRow,
          toCol,
          attackerId: socket.id,
          defenderOwnerId: defender.owner,
          unitType: fromCell.type,
          deadline,
          choices: {},
          timeoutId: setTimeout(() => resolveTieBreaker(room), TIE_BREAKER_DURATION_MS),
        };
        room.players.forEach((p) =>
          io.to(p.id).emit('tie_break_start', { deadline, unitType: fromCell.type })
        );
        return;
      } else {
        grid[fromRow][fromCol] = null;
        grid[toRow][toCol] = { ...grid[toRow][toCol], revealed: true };
        combatResult = { attackerType: fromCell.type, defenderType: defender.type, result: 'defender_wins' };
      }
    }

    if (!gameOver) {
      gs.currentTurn = room.players.find((p) => p.id !== socket.id)?.id ?? gs.currentTurn;

      room.players.forEach((p) => {
        const mobile = countMobileUnits(grid, p.id);
        if (mobile === 0) {
          gameOver = room.players.find((x) => x.id !== p.id)?.id ?? null;
        }
      });
      if (gameOver) room.phase = 'GAME_OVER';
    }

    if (combatResult) {
      room.players.forEach((p) => {
        const entry = sanitizeGameStateForPlayer(room.gameState, p.id);
        io.to(p.id).emit('combat_event', { ...combatResult, attackerId: socket.id, newGameState: entry });
      });
    } else {
      emitGameState(room);
    }

    if (gameOver) {
      room.players.forEach((p) =>
        io.to(p.id).emit('game_over', { winnerId: gameOver, flagCapture: !combatResult })
      );
    }
  });

  socket.on('submit_tie_choice', ({ choice }) => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (!room || room.phase !== 'TIE_BREAKER' || !room.tieBreaker) return;
    if (!['rock', 'paper', 'scissors'].includes(choice)) return;

    const tb = room.tieBreaker;
    if (socket.id !== tb.attackerId && socket.id !== tb.defenderOwnerId) return;

    tb.choices[socket.id] = choice;
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
        else io.to(socket.roomId).emit('room_updated', { roomId: socket.roomId, players: room.players });
      }
      socket.leave(socket.roomId);
      socket.roomId = null;
    }
  });

  socket.on('disconnect', () => {
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        if (room.setupInterval) clearInterval(room.setupInterval);
        if (room.tieBreaker?.timeoutId) clearTimeout(room.tieBreaker.timeoutId);
        room.players = room.players.filter((p) => p.id !== socket.playerId);
        if (room.players.length === 0) rooms.delete(socket.roomId);
        else io.to(socket.roomId).emit('room_updated', { roomId: socket.roomId, players: room.players });
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
