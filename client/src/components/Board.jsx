import { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../context/GameContext';
import CombatModal from './CombatModal';
import TieBreakerModal from './TieBreakerModal';
import FlagCaptureCelebration from './FlagCaptureCelebration';
import GamePiece, { isColorClash } from './GamePiece';

const GRID_SIZE = 6;

const UNIT_IMAGE_MAP = {
  rock: '/assets/unit-rock.png',
  paper: '/assets/unit-paper.png',
  scissors: '/assets/unit-scissors.png',
  flag: '/assets/unit-flag.png',
  trap: '/assets/unit-trap.png',
  hidden: '/assets/unit-hidden.png',
};

function getUnitImagePath(unit) {
  if (!unit?.type) return null;
  if (unit.type === 'hidden') return '/assets/unit-hidden.png';
  return UNIT_IMAGE_MAP[unit.type] ?? '/assets/unit-hidden.png';
}

/** Display color for opponent's glow when in color-clash (Gold Away Kit). */
const AWAY_KIT_GLOW = '#eab308';

const IMMOBILE_TYPES = ['flag', 'trap'];

const TILE_BASE =
  'w-full h-full flex items-center justify-center p-1 text-xl sm:text-2xl font-medium transition-all duration-200 cursor-pointer select-none hover:brightness-110';

function BoardCellInner({
  row,
  col,
  cell,
  isSelected,
  isValidMove,
  isMine,
  myTeamColor,
  opponentTeamColor,
  displayColor,
  isHidden,
  isRevealed,
  isBattleTarget,
  isDrawSquare,
  combatState,
  tieBreakerState,
  isPlayer2,
  canMoveThisTurn,
  onCellClick,
}) {
  const isCheckeredLight = (row + col) % 2 === 0;
  let bgClass = isCheckeredLight ? 'bg-slate-700' : 'bg-slate-800';
  if (isValidMove) bgClass = 'bg-yellow-300 dark:bg-yellow-600/80';
  if (isSelected) bgClass += ' ring-2 ring-amber-500 ring-offset-1';
  if (isBattleTarget) bgClass += ' ring-4 ring-red-600 ring-offset-1 animate-pulse';
  if (isDrawSquare) bgClass += ' bg-stone-400 dark:bg-stone-500 animate-pulse';
  if (canMoveThisTurn && !isSelected) bgClass += ' ring-2 ring-amber-400 ring-offset-1';

  return (
    <div
      className="flex-1 min-w-0 aspect-square flex items-center justify-center"
      style={isPlayer2 ? { transform: 'rotate(180deg)' } : undefined}
      data-row={row}
      data-col={col}
    >
      <motion.div
        role="button"
        tabIndex={0}
        onClick={() => onCellClick(row, col)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onCellClick(row, col);
        }}
        className={`${TILE_BASE} border border-slate-800/60 ${bgClass} relative ${isRevealed ? 'ring-1 ring-sky-400/70 ring-inset' : ''}`}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.15 }}
      >
        {isRevealed && (
          <span className="absolute top-0 right-0 text-[8px] sm:text-[10px] leading-none bg-sky-500/80 text-white rounded-bl px-0.5" title="Revealed to enemy">👁</span>
        )}
        {isBattleTarget && combatState && (
          <span
            className="absolute inset-0 flex items-center justify-center pointer-events-none text-2xl opacity-90"
            style={isPlayer2 ? { transform: 'rotate(180deg)' } : undefined}
          >
            ⚔️
          </span>
        )}
        {isDrawSquare && (
          <motion.span
            className="absolute inset-0 flex items-center justify-center pointer-events-none text-lg font-bold text-white drop-shadow-lg z-10"
            style={isPlayer2 ? { transform: 'rotate(180deg)' } : undefined}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            🤝 DRAW
          </motion.span>
        )}
        {cell && (
          <GamePiece
            piece={cell}
            isMine={isMine}
            myTeamColor={myTeamColor}
            opponentTeamColor={opponentTeamColor}
            displayColor={displayColor}
            isSelected={isSelected}
          />
        )}
      </motion.div>
    </div>
  );
}

function areCellPropsEqual(prev, next) {
  if (prev.row !== next.row || prev.col !== next.col) return false;
  if (prev.isSelected !== next.isSelected || prev.isValidMove !== next.isValidMove) return false;
  if (prev.isHidden !== next.isHidden || prev.isRevealed !== next.isRevealed) return false;
  if (prev.isMine !== next.isMine) return false;
  if (prev.myTeamColor !== next.myTeamColor || prev.opponentTeamColor !== next.opponentTeamColor) return false;
  if (prev.displayColor !== next.displayColor) return false;
  if (prev.isBattleTarget !== next.isBattleTarget || prev.isDrawSquare !== next.isDrawSquare) return false;
  if (prev.combatState !== next.combatState || prev.tieBreakerState !== next.tieBreakerState) return false;
  if (prev.canMoveThisTurn !== next.canMoveThisTurn) return false;
  const pc = prev.cell;
  const nc = next.cell;
  if (pc === nc) return true;
  if (!pc !== !nc) return false;
  if (pc?.type !== nc?.type || pc?.owner !== nc?.owner || pc?.revealed !== nc?.revealed) return false;
  return true;
}

const BoardCell = memo(BoardCellInner, areCellPropsEqual);

function getAdjacentKeys(row, col) {
  const keys = new Set();
  if (row > 0) keys.add(`${row - 1},${col}`);
  if (row < GRID_SIZE - 1) keys.add(`${row + 1},${col}`);
  if (col > 0) keys.add(`${row},${col - 1}`);
  if (col < GRID_SIZE - 1) keys.add(`${row},${col + 1}`);
  return keys;
}

export default function Board() {
  const { gameState, playerId, player, players, gameOver, combatState, combatPending, tiePending, clearCombatAndApplyState, tieBreakerState, submitTieChoice, rematchRequested, requestRematch, makeMove, lastTieCombat, authUser, authToken } = useGame();
  const isPlayer2 = player?.side === 'top';
  const [selected, setSelected] = useState(null); // { row, col }

  const hasValidGame = gameState && Array.isArray(gameState.grid) && gameState.grid.length > 0;

  const isMyTurn = gameState?.currentTurn === playerId;

  useEffect(() => {
    setSelected(null);
  }, [gameState]);

  const validMoves = useMemo(() => {
    if (!selected || !gameState?.grid || !isMyTurn) return new Set();
    const cell = gameState.grid[selected.row]?.[selected.col];
    if (!cell || cell.owner !== playerId || IMMOBILE_TYPES.includes(cell.type)) return new Set();
    const adj = getAdjacentKeys(selected.row, selected.col);
    const valid = new Set();
    adj.forEach((key) => {
      const [r, c] = key.split(',').map(Number);
      const target = gameState.grid[r]?.[c];
      if (!target) valid.add(key); // empty
      else if (target.owner !== playerId) valid.add(key); // enemy
    });
    return valid;
  }, [selected, gameState?.grid, playerId, isMyTurn]);

  const activeBattle = combatState || combatPending || tiePending || tieBreakerState;
  const battleTargetKey = activeBattle?.toRow != null ? `${activeBattle.toRow},${activeBattle.toCol}` : null;
  const isDraw = combatState?.result === 'both_destroyed';

  const handleCellClick = useCallback((row, col) => {
    if (gameOver || tieBreakerState) return;

    const grid = gameState?.grid;
    const cell = grid?.[row]?.[col];
    const key = `${row},${col}`;

    if (validMoves.has(key)) {
      makeMove(selected.row, selected.col, row, col);
      setSelected(null);
      return;
    }

    if (isMyTurn && cell?.owner === playerId && !IMMOBILE_TYPES.includes(cell?.type)) {
      setSelected((prev) => (prev?.row === row && prev?.col === col ? null : { row, col }));
    } else {
      setSelected(null);
    }
  }, [gameOver, tieBreakerState, gameState?.grid, validMoves, isMyTurn, playerId, selected, makeMove]);

  if (!hasValidGame) {
    return (
      <div className="inline-flex flex-col rounded-2xl overflow-hidden shadow-lg border border-white/10 p-6 bg-white/5 backdrop-blur-xl">
        <p className="text-sm text-white/70">
          מחכה ליריב שיצטרף...
        </p>
      </div>
    );
  }

  const { grid, currentTurn } = gameState;
  const myTurn = currentTurn === playerId;

  const me = players.find((p) => p.id === playerId) || player;
  const opponent = players.find((p) => p.id !== playerId);
  const myTeamColor = me?.teamColor ?? '';
  const opponentTeamColor = opponent?.teamColor ?? '#ef4444';
  const isClash = isColorClash(myTeamColor, opponentTeamColor);

  return (
    <div className="relative flex flex-col items-center gap-4">
      <div
        className={`relative w-[95vw] max-w-lg aspect-square flex flex-col rounded-lg overflow-hidden shadow-lg border-2 border-stone-300 dark:border-stone-600 ${tieBreakerState ? 'pointer-events-none' : ''}`}
        style={isPlayer2 ? { transform: 'rotate(180deg)' } : undefined}
      >
        <CombatModal key={combatState?.battleId ?? 'combat'} combatState={combatState} playerId={playerId} isPlayer2={isPlayer2} onComplete={clearCombatAndApplyState} />
        {!(combatState || combatPending) && (
          <TieBreakerModal key={tieBreakerState?.battleId ?? 'tie'} tieBreakerState={tieBreakerState} isPlayer2={isPlayer2} onSubmitChoice={submitTieChoice} lastTieCombat={lastTieCombat} />
        )}
        {gameOver && (
          <FlagCaptureCelebration
            gameOverPayload={gameOver}
            won={gameOver.winnerId === playerId}
            winType={gameOver.flagCapture ? 'flag' : 'no_units'}
            rematchRequested={rematchRequested}
            requestRematch={requestRematch}
            playerId={playerId}
            isPlayer2={isPlayer2}
            disconnectWin={!!gameOver.disconnectWin}
            opponentConnected={players.length === 2}
            onComplete={() => {}}
            myId={authUser?.id ?? (typeof playerId === 'number' ? playerId : undefined)}
            opponentId={opponent?.id}
            myName={me?.name}
            opponentName={opponent?.name}
            myTeamColor={myTeamColor}
            opponentTeamColor={opponentTeamColor}
            authToken={authToken}
          />
        )}
        {Array.from({ length: GRID_SIZE }, (_, row) => (
          <div key={row} className="flex flex-1 min-h-0">
            {Array.from({ length: GRID_SIZE }, (_, col) => {
              const cell = grid[row]?.[col];
              const isMyUnit = cell?.owner === playerId;
              const isEnemyUnit = cell && !isMyUnit;
              const key = `${row},${col}`;
              const isValidMove = validMoves.has(key);
              const isSelected = selected?.row === row && selected?.col === col;

              const isBattleTarget = key === battleTargetKey;
              const isDrawSquare = isBattleTarget && isDraw;

              const isMyMobileUnit = isMyUnit && cell && !IMMOBILE_TYPES.includes(cell.type);
              const canMoveThisTurn = isMyMobileUnit && myTurn;

              const isRevealed = cell?.revealed === true && isMyUnit;
              const isHidden = cell?.type === 'hidden';

              const displayColor = isMyUnit ? myTeamColor : (isClash ? AWAY_KIT_GLOW : opponentTeamColor);

              return (
                <BoardCell
                  key={key}
                  row={row}
                  col={col}
                  cell={cell}
                  isSelected={isSelected}
                  isValidMove={isValidMove}
                  isMine={isMyUnit}
                  myTeamColor={myTeamColor}
                  opponentTeamColor={opponentTeamColor}
                  displayColor={displayColor}
                  isHidden={isHidden}
                  isRevealed={isRevealed}
                  isBattleTarget={isBattleTarget && (combatState || combatPending || tiePending || tieBreakerState)}
                  isDrawSquare={isDrawSquare}
                  combatState={combatState}
                  tieBreakerState={tieBreakerState}
                  isPlayer2={isPlayer2}
                  canMoveThisTurn={canMoveThisTurn}
                  onCellClick={handleCellClick}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}