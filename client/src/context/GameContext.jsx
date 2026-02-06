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
  const [combatPending, setCombatPending] = useState(null);
  const [tiePending, setTiePending] = useState(null);
  const [lastTieCombat, setLastTieCombat] = useState(null);
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
  // CRITICAL UI lock: prevents re-triggering animations due to duplicate/overlapping events.
  const isAnimatingRef = useRef(false);
  const preBattleTimeoutRef = useRef(null);

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

    const onConnect = () => {
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
    };

    const onDisconnect = () => {
      setConnected(false);
      reconnectRoomId = stateRef.current.roomId;
      reconnectPlayerName = stateRef.current.player?.name;
    };

    const onJoinedRoom = ({ roomId: rid, playerId: pid, player: p, players: pl }) => {
      setRoomId(rid);
      setPlayerId(pid);
      setPlayer(p);
      setPlayers(pl);
      setGameState(null); // cleared until game_start
      setError(null);
    };

    const onRoomFull = () => {
      setError('Room is full');
    };

    const onRoomUpdated = ({ players: pl }) => {
      setPlayers(pl);
    };

    const onSetupStart = ({ grid, setupReady: sr, roomId: rid, players: pl }) => {
      setPhase('SETUP');
      setSetupPhase(true);
      setSetupGrid(grid);
      setSetupReady(sr ?? {});
      setGameState(null);
      setGameOver(null);
      setRematchRequested({});
      if (rid) setRoomId(rid);
      if (pl && Array.isArray(pl)) setPlayers(pl);
    };

    const onSetupUpdate = ({ grid, setupReady: sr }) => {
      setSetupGrid(grid);
      setSetupReady(sr ?? {});
    };

    const onSetupTimer = ({ remaining }) => {
      setSetupTimer(remaining);
    };

    const onGameStart = ({ gameState: gs }) => {
      setPhase('PLAYING');
      setSetupPhase(false);
      setSetupGrid(null);
      setSetupTimer(null);
      setGameState(gs);
      setGameOver(null);
      setCombatState(null);
      setCombatPending(null);
      setTiePending(null);
      setPendingGameState(null);
      setTieBreakerState(null);
      isAnimatingRef.current = false;
      if (preBattleTimeoutRef.current) clearTimeout(preBattleTimeoutRef.current);
      preBattleTimeoutRef.current = null;
    };

    const onGameStateUpdate = ({ gameState: gs }) => {
      setGameState(gs);
    };

    const PRE_BATTLE_DELAY_MS = 900;

    const onCombatEvent = ({ battleId, attackerType, defenderType, result, attackerId, fromRow, fromCol, toRow, toCol, newGameState }) => {
      if (isAnimatingRef.current) return; // DROP overlapping animation events
      isAnimatingRef.current = true;
      if (preBattleTimeoutRef.current) clearTimeout(preBattleTimeoutRef.current);
      preBattleTimeoutRef.current = null;
      // Clean slate so old state can't confuse AnimatePresence.
      setCombatState(null);
      setCombatPending(null);
      const payload = { battleId, attackerType, defenderType, result, attackerId, fromRow, fromCol, toRow, toCol };
      setPendingGameState(newGameState ?? null);
      setCombatPending(payload);
      preBattleTimeoutRef.current = setTimeout(() => {
        setCombatState(payload);
        setCombatPending(null);
        preBattleTimeoutRef.current = null;
      }, PRE_BATTLE_DELAY_MS);
    };

    const onTieBreakStart = ({ battleId, deadline, unitType, fromRow, fromCol, toRow, toCol }) => {
      // Highlight the battle square first, then open Sudden Death.
      const pending = { battleId, deadline, unitType, isRestart: false, fromRow, fromCol, toRow, toCol };
      setTiePending(pending);
      setTimeout(() => {
        setTieBreakerState(pending);
        setTiePending(null);
      }, PRE_BATTLE_DELAY_MS);
    };

    const onTieBreakTie = ({ battleId, combatResult, attackerId, fromRow, fromCol, toRow, toCol, newGameState }) => {
      const payload = {
        battleId,
        attackerType: combatResult.attackerType,
        defenderType: combatResult.defenderType,
        result: combatResult.result,
        attackerId,
        fromRow, fromCol, toRow, toCol,
      };
      // Apply game state immediately and just remember the last tie combat for Sudden Death UI.
      if (newGameState) {
        setGameState(newGameState);
        setPendingGameState(null);
      } else {
        setPendingGameState(null);
      }
      setLastTieCombat(payload);
      // IMPORTANT: do NOT trigger CombatModal here – we want to go straight back to selection.
      isAnimatingRef.current = false;
    };

    const onTieBreakRestart = ({ battleId, deadline, timeout, fromRow, fromCol, toRow, toCol }) => {
      setTieBreakerState((prev) => ({ ...prev, battleId, deadline, isRestart: true, wasTimeout: !!timeout, fromRow, fromCol, toRow, toCol }));
    };

    const onTieBreakResolved = ({ battleId, combatResult, attackerId, fromRow, fromCol, toRow, toCol, newGameState }) => {
      if (isAnimatingRef.current) return; // DROP overlapping animation events
      isAnimatingRef.current = true;
      if (preBattleTimeoutRef.current) clearTimeout(preBattleTimeoutRef.current);
      preBattleTimeoutRef.current = null;
      setTieBreakerState(null);
      setCombatState(null);
      setCombatPending(null);
      const payload = {
        battleId,
        attackerType: combatResult.attackerType,
        defenderType: combatResult.defenderType,
        result: combatResult.result,
        attackerId,
        fromRow, fromCol, toRow, toCol,
      };
      setPendingGameState(newGameState ?? null);
      setCombatPending(payload);
      preBattleTimeoutRef.current = setTimeout(() => {
        setCombatState(payload);
        setCombatPending(null);
        preBattleTimeoutRef.current = null;
      }, PRE_BATTLE_DELAY_MS);
    };


    const onGameOver = ({ winnerId, flagCapture, disconnectWin }) => {
      setGameOver({ winnerId, flagCapture: !!flagCapture, disconnectWin: !!disconnectWin });
      setTieBreakerState(null);
      setRematchRequested({});
    };

    const onRematchUpdate = ({ rematchRequested: rr }) => {
      setRematchRequested(rr ?? {});
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('joined_room', onJoinedRoom);
    s.on('room_full', onRoomFull);
    s.on('room_updated', onRoomUpdated);
    s.on('setup_start', onSetupStart);
    s.on('setup_update', onSetupUpdate);
    s.on('setup_timer', onSetupTimer);
    s.on('game_start', onGameStart);
    s.on('game_state_update', onGameStateUpdate);
    s.on('combat_event', onCombatEvent);
    s.on('tie_break_start', onTieBreakStart);
    s.on('tie_break_tie', onTieBreakTie);
    s.on('tie_break_restart', onTieBreakRestart);
    s.on('tie_break_resolved', onTieBreakResolved);
    s.on('game_over', onGameOver);
    s.on('rematch_update', onRematchUpdate);

    setSocket(s);
    return () => {
      if (preBattleTimeoutRef.current) clearTimeout(preBattleTimeoutRef.current);
      preBattleTimeoutRef.current = null;
      isAnimatingRef.current = false;
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('joined_room', onJoinedRoom);
      s.off('room_full', onRoomFull);
      s.off('room_updated', onRoomUpdated);
      s.off('setup_start', onSetupStart);
      s.off('setup_update', onSetupUpdate);
      s.off('setup_timer', onSetupTimer);
      s.off('game_start', onGameStart);
      s.off('game_state_update', onGameStateUpdate);
      s.off('combat_event', onCombatEvent);
      s.off('tie_break_start', onTieBreakStart);
      s.off('tie_break_tie', onTieBreakTie);
      s.off('tie_break_restart', onTieBreakRestart);
      s.off('tie_break_resolved', onTieBreakResolved);
      s.off('game_over', onGameOver);
      s.off('rematch_update', onRematchUpdate);
      s.disconnect();
    };
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
    setCombatPending(null);
    setTiePending(null);
    setLastTieCombat(null);
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
    // Unlock ONLY when user is ready to select again.
    isAnimatingRef.current = false;
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
        combatPending,
        tiePending,
        lastTieCombat,
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
