import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const GameContext = createContext(null);

// VITE_SERVER_URL for deployment. If missing, fallback to localhost:3001.
const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export function GameProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [playerId, setPlayerId] = useState(null);
  const [player, setPlayer] = useState(null);
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [combatState, setCombatState] = useState(null);
  const [pendingGameState, setPendingGameState] = useState(null);
  const [tieBreakerState, setTieBreakerState] = useState(null);
  const [phase, setPhase] = useState('WAITING');
  const [setupPhase, setSetupPhase] = useState(false);
  const [setupGrid, setSetupGrid] = useState(null);
  const [setupReady, setSetupReady] = useState({});
  const [setupTimer, setSetupTimer] = useState(null);
  const [rematchRequested, setRematchRequested] = useState({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const stateRef = useRef({ roomId: '', player: null });
  stateRef.current = { roomId, player };

  useEffect(() => {
    const s = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    let reconnectRoomId = null;
    let reconnectPlayerName = null;

    s.on('connect', () => {
      setConnected(true);
      setError(null);
      if (reconnectRoomId) {
        const rid = reconnectRoomId;
        reconnectRoomId = null;
        const persistentId =
          (typeof localStorage !== 'undefined' && localStorage.getItem('rps_player_id')) ||
          crypto.randomUUID();
        if (typeof localStorage !== 'undefined') localStorage.setItem('rps_player_id', persistentId);
        s.emit('join_room', {
          roomId: rid,
          playerName: reconnectPlayerName || undefined,
          persistentPlayerId: persistentId,
        });
        reconnectPlayerName = null;
      }
    });

    s.on('disconnect', () => {
      setConnected(false);
      reconnectRoomId = stateRef.current.roomId;
      reconnectPlayerName = stateRef.current.player?.name;
    });

    s.on('joined_room', ({ roomId: rid, playerId: pid, player: p, players: pl }) => {
      setRoomId(rid);
      setPlayerId(pid);
      setPlayer(p);
      setPlayers(pl);
      setGameState(null); // cleared until game_start
      setError(null);
    });

    s.on('room_full', () => {
      setError('Room is full');
    });

    s.on('room_updated', ({ players: pl }) => {
      setPlayers(pl);
    });

    s.on('setup_start', ({ grid, setupReady: sr, roomId: rid, players: pl }) => {
      setPhase('SETUP');
      setSetupPhase(true);
      setSetupGrid(grid);
      setSetupReady(sr ?? {});
      setGameState(null);
      setGameOver(null);
      setRematchRequested({});
      if (rid) setRoomId(rid);
      if (pl && Array.isArray(pl)) setPlayers(pl);
    });

    s.on('setup_update', ({ grid, setupReady: sr }) => {
      setSetupGrid(grid);
      setSetupReady(sr ?? {});
    });

    s.on('setup_timer', ({ remaining }) => {
      setSetupTimer(remaining);
    });

    s.on('game_start', ({ gameState: gs }) => {
      setPhase('PLAYING');
      setSetupPhase(false);
      setSetupGrid(null);
      setSetupTimer(null);
      setGameState(gs);
      setGameOver(null);
      setCombatState(null);
      setPendingGameState(null);
      setTieBreakerState(null);
    });

    s.on('game_state_update', ({ gameState: gs }) => {
      setGameState(gs);
    });

    s.on('combat_event', ({ attackerType, defenderType, result, attackerId, fromRow, fromCol, toRow, toCol, newGameState }) => {
      setCombatState({ attackerType, defenderType, result, attackerId, fromRow, fromCol, toRow, toCol });
      setPendingGameState(newGameState ?? null);
    });

    s.on('tie_break_start', ({ deadline, unitType, fromRow, fromCol, toRow, toCol }) => {
      setTieBreakerState({ deadline, unitType, isRestart: false, fromRow, fromCol, toRow, toCol });
    });

    s.on('tie_break_tie', ({ combatResult, attackerId, fromRow, fromCol, toRow, toCol, newGameState }) => {
      setCombatState({
        attackerType: combatResult.attackerType,
        defenderType: combatResult.defenderType,
        result: combatResult.result,
        attackerId,
        fromRow, fromCol, toRow, toCol,
      });
      setPendingGameState(newGameState ?? null);
    });

    s.on('tie_break_restart', ({ deadline, timeout, fromRow, fromCol, toRow, toCol }) => {
      setTieBreakerState((prev) => ({ ...prev, deadline, isRestart: true, wasTimeout: !!timeout, fromRow, fromCol, toRow, toCol }));
    });

    s.on('tie_break_resolved', ({ combatResult, attackerId, fromRow, fromCol, toRow, toCol, newGameState }) => {
      setTieBreakerState(null);
      setCombatState({
        attackerType: combatResult.attackerType,
        defenderType: combatResult.defenderType,
        result: combatResult.result,
        attackerId,
        fromRow, fromCol, toRow, toCol,
      });
      setPendingGameState(newGameState ?? null);
    });


    s.on('game_over', ({ winnerId, flagCapture }) => {
      setGameOver({ winnerId, flagCapture: !!flagCapture });
      setTieBreakerState(null);
      setRematchRequested({});
    });

    s.on('rematch_update', ({ rematchRequested: rr }) => {
      setRematchRequested(rr ?? {});
    });

    setSocket(s);
    return () => s.disconnect();
  }, []);

  useEffect(() => {
    if (!socket || players.length !== 2) return;
    if (gameState || setupPhase) return;

    const poll = () => socket.emit('request_game_state');
    poll();
    const interval = setInterval(poll, 1000);
    return () => clearInterval(interval);
  }, [socket, players.length, gameState, setupPhase]);

  useEffect(() => {
    if (!socket || !gameOver) return;
    const hasRequested = rematchRequested?.[playerId];
    if (!hasRequested) return;

    const poll = () => socket.emit('request_game_state');
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [socket, gameOver, rematchRequested, playerId]);

  const joinRoom = (rid, playerName) => {
    const roomIdToUse = (rid || '').trim() || crypto.randomUUID().slice(0, 8);
    if (!socket) return;
    setError(null);
    const persistentId =
      (typeof localStorage !== 'undefined' && localStorage.getItem('rps_player_id')) ||
      crypto.randomUUID();
    if (typeof localStorage !== 'undefined') localStorage.setItem('rps_player_id', persistentId);
    socket.emit('join_room', {
      roomId: roomIdToUse,
      playerName: playerName || undefined,
      persistentPlayerId: persistentId,
    });
  };

  const leaveRoom = () => {
    if (socket) socket.emit('leave_room');
    setRoomId('');
    setPlayerId(null);
    setPlayer(null);
    setPlayers([]);
    setGameState(null);
    setGameOver(null);
    setCombatState(null);
    setPendingGameState(null);
    setTieBreakerState(null);
    setPhase('WAITING');
    setSetupPhase(false);
    setSetupGrid(null);
    setSetupReady({});
    setSetupTimer(null);
    setRematchRequested({});
  };

  const placeUnit = (row, col, type) => {
    if (socket) socket.emit('place_unit', { row, col, type });
  };

  const removeUnit = (row, col) => {
    if (socket) socket.emit('remove_unit', { row, col });
  };

  const randomizeSetup = () => {
    if (socket) socket.emit('randomize_setup');
  };

  const setupReadySubmit = () => {
    if (socket) socket.emit('setup_ready');
  };

  const makeMove = (fromRow, fromCol, toRow, toCol) => {
    if (socket) socket.emit('make_move', { fromRow, fromCol, toRow, toCol });
  };

  const submitTieChoice = (choice) => {
    if (socket) socket.emit('submit_tie_choice', { choice });
  };

  const requestRematch = () => {
    if (socket) socket.emit('request_rematch');
  };

  const clearCombatAndApplyState = () => {
    setCombatState(null);
    if (pendingGameState) {
      setGameState(pendingGameState);
      setPendingGameState(null);
    }
  };

  return (
    <GameContext.Provider
      value={{
        socket,
        roomId,
        playerId,
        player,
        players,
        gameState,
        gameOver,
        combatState,
        clearCombatAndApplyState,
        tieBreakerState,
        submitTieChoice,
        rematchRequested,
        requestRematch,
        makeMove,
        phase,
        setupPhase,
        setupGrid,
        setupReady,
        setupTimer,
        placeUnit,
        removeUnit,
        randomizeSetup,
        setupReadySubmit,
        connected,
        error,
        joinRoom,
        leaveRoom,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
