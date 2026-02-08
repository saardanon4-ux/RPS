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
  const [emojiReactions, setEmojiReactions] = useState({});
  const [authUser, setAuthUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [roomListVersion, setRoomListVersion] = useState(0);
  const [showCinematic, setShowCinematic] = useState(false);
  const [cinematicWinnerColor, setCinematicWinnerColor] = useState(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const stateRef = useRef({ roomId: '', player: null });
  stateRef.current = { roomId, player };
  const playersRef = useRef([]);
  const pendingGameOverRef = useRef(null);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);
  // CRITICAL UI lock: prevents re-triggering animations due to duplicate/overlapping events.
  const isAnimatingRef = useRef(false);
  const preBattleTimeoutRef = useRef(null);
  const setupTimerAutoSubmitRef = useRef(false);

  const handleCinematicComplete = () => {
    setShowCinematic(false);
    setCinematicWinnerColor(null);
    const payload = pendingGameOverRef.current;
    pendingGameOverRef.current = null;
    if (payload) setGameOver(payload);
  };

  useEffect(() => {
    // Hydrate auth state from localStorage on first load
    if (typeof localStorage === 'undefined') return;
    const storedToken = localStorage.getItem('rps_auth_token');
    const storedUser = localStorage.getItem('rps_auth_user');
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setAuthUser(parsedUser);
        setAuthToken(storedToken);
      } catch {
        localStorage.removeItem('rps_auth_token');
        localStorage.removeItem('rps_auth_user');
      }
    }
  }, []);

  useEffect(() => {
    // Do not open a game socket before we have an auth token
    if (!authToken) return;

    const s = io(SOCKET_URL, {
      auth: { token: authToken, userId: authUser?.id },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      // More forgiving connection / heartbeat settings for mobile
      timeout: 60000,
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    let reconnectRoomId = null;

    const onConnect = () => {
      setConnected(true);
      setError(null);
      if (reconnectRoomId) {
        const rid = reconnectRoomId;
        reconnectRoomId = null;
        s.emit('join_room', { roomId: rid });
      }
    };

    const onDisconnect = () => {
      setConnected(false);
      reconnectRoomId = stateRef.current.roomId;
    };

    const onJoinedRoom = ({ roomId: rid, playerId: pid, player: p, players: pl }) => {
      setRoomId(rid);
      setPlayerId(pid);
      setPlayer(p);
      setPlayers(pl);
      setGameState(null); // cleared until game_start
      setError(null);
      setOpponentDisconnected(false);
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

    const onGameRestored = ({ gameState: gs, phase: p }) => {
      if (p === 'PLAYING' && gs) {
        onGameStart({ gameState: gs });
      }
    };

    const onPlayerDisconnected = () => setOpponentDisconnected(true);
    const onPlayerReconnected = () => setOpponentDisconnected(false);

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
      const currentPlayers = playersRef.current;
      const winner = currentPlayers.find((p) => p.id === winnerId);
      const winnerColor = winner?.teamColor || 'red';
      pendingGameOverRef.current = { winnerId, flagCapture: !!flagCapture, disconnectWin: !!disconnectWin };
      setCinematicWinnerColor(winnerColor);
      setShowCinematic(true);
      setTieBreakerState(null);
      setRematchRequested({});
    };

    const onRematchUpdate = ({ rematchRequested: rr }) => {
      setRematchRequested(rr ?? {});
    };

    const onEmojiReaction = ({ fromPlayerId, emoji }) => {
      if (!fromPlayerId || !emoji) return;
      const ts = Date.now();
      setEmojiReactions((prev) => ({
        ...prev,
        [fromPlayerId]: { emoji, at: ts },
      }));
      setTimeout(() => {
        setEmojiReactions((prev) => {
          const entry = prev[fromPlayerId];
          if (!entry || entry.at !== ts) return prev;
          const { [fromPlayerId]: _removed, ...rest } = prev;
          return rest;
        });
      }, 3000);
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('joined_room', onJoinedRoom);
    s.on('room_full', onRoomFull);
    s.on('room_updated', onRoomUpdated);
    const onRoomUpdate = () => setRoomListVersion((v) => v + 1);
    s.on('room_update', onRoomUpdate);
    s.on('setup_start', onSetupStart);
    s.on('setup_update', onSetupUpdate);
    s.on('setup_timer', onSetupTimer);
    s.on('game_start', onGameStart);
    s.on('game_restored', onGameRestored);
    s.on('game_state_update', onGameStateUpdate);
    s.on('player_disconnected', onPlayerDisconnected);
    s.on('player_reconnected', onPlayerReconnected);
    s.on('combat_event', onCombatEvent);
    s.on('tie_break_start', onTieBreakStart);
    s.on('tie_break_tie', onTieBreakTie);
    s.on('tie_break_restart', onTieBreakRestart);
    s.on('tie_break_resolved', onTieBreakResolved);
    s.on('game_over', onGameOver);
    s.on('rematch_update', onRematchUpdate);
    s.on('emoji_reaction', onEmojiReaction);

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
      s.off('room_update', onRoomUpdate);
      s.off('setup_start', onSetupStart);
      s.off('setup_update', onSetupUpdate);
      s.off('setup_timer', onSetupTimer);
      s.off('game_start', onGameStart);
      s.off('game_restored', onGameRestored);
      s.off('game_state_update', onGameStateUpdate);
      s.off('player_disconnected', onPlayerDisconnected);
      s.off('player_reconnected', onPlayerReconnected);
      s.off('combat_event', onCombatEvent);
      s.off('tie_break_start', onTieBreakStart);
      s.off('tie_break_tie', onTieBreakTie);
      s.off('tie_break_restart', onTieBreakRestart);
      s.off('tie_break_resolved', onTieBreakResolved);
      s.off('game_over', onGameOver);
      s.off('rematch_update', onRematchUpdate);
      s.off('emoji_reaction', onEmojiReaction);
      s.disconnect();
    };
  }, [authToken, authUser?.id]);

  useEffect(() => {
    if (!socket || players.length !== 2) return;
    if (gameState || setupPhase) return;

    const poll = () => socket.emit('request_game_state');
    poll();
    const interval = setInterval(poll, 1000);
    return () => clearInterval(interval);
  }, [socket, players.length, gameState, setupPhase]);

  // When setup timer hits 0 and local player is not ready: auto randomize + submit (safety net)
  useEffect(() => {
    if (!setupPhase) {
      setupTimerAutoSubmitRef.current = false;
      return;
    }
    if (setupTimer !== 0 || !socket || !playerId) return;
    if (setupReady?.[playerId]) return;
    if (setupTimerAutoSubmitRef.current) return;
    setupTimerAutoSubmitRef.current = true;
    socket.emit('randomize_setup');
    const t = setTimeout(() => {
      socket.emit('setup_ready');
    }, 250);
    return () => clearTimeout(t);
  }, [setupPhase, setupTimer, setupReady, playerId, socket]);

  useEffect(() => {
    if (!socket || !gameOver) return;
    const hasRequested = rematchRequested?.[playerId];
    if (!hasRequested) return;

    const poll = () => socket.emit('request_game_state');
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [socket, gameOver, rematchRequested, playerId]);

  const joinRoom = (rid) => {
    const roomIdToUse = (rid || '').trim() || crypto.randomUUID().slice(0, 8);
    if (!socket) return;
    setError(null);
    socket.emit('join_room', {
      roomId: roomIdToUse,
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
    setShowCinematic(false);
    setCinematicWinnerColor(null);
    pendingGameOverRef.current = null;
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
    setOpponentDisconnected(false);
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

  const sendEmoji = (emoji) => {
    if (!socket || !roomId || !playerId || !emoji) return;
    socket.emit('send_emoji', { emoji });
  };

  const setAuth = (user, token) => {
    setAuthUser(user);
    setAuthToken(token);
    if (typeof localStorage !== 'undefined') {
      if (token) {
        localStorage.setItem('rps_auth_token', token);
      } else {
        localStorage.removeItem('rps_auth_token');
      }
      if (user) {
        localStorage.setItem('rps_auth_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('rps_auth_user');
      }
    }
  };

  const clearAuth = () => {
    setAuthUser(null);
    setAuthToken(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('rps_auth_token');
      localStorage.removeItem('rps_auth_user');
    }
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
        emojiReactions,
        sendEmoji,
        authUser,
        authToken,
        setAuth,
        clearAuth,
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
        roomListVersion,
        showCinematic,
        cinematicWinnerColor,
        handleCinematicComplete,
        opponentDisconnected,
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
