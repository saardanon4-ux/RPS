import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../context/GameContext';
import CombatModal from './CombatModal';
import TieBreakerModal from './TieBreakerModal';

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

const IMMOBILE_TYPES = ['flag', 'trap'];

const TILE_BASE =
  'flex-1 min-w-0 aspect-square flex items-center justify-center p-1 text-xl sm:text-2xl font-medium transition-colors cursor-pointer select-none';

function getAdjacentKeys(row, col) {
  const keys = new Set();
  if (row > 0) keys.add(`${row - 1},${col}`);
  if (row < GRID_SIZE - 1) keys.add(`${row + 1},${col}`);
  if (col > 0) keys.add(`${row},${col - 1}`);
  if (col < GRID_SIZE - 1) keys.add(`${row},${col + 1}`);
  return keys;
}

export default function Board() {
  const { gameState, playerId, gameOver, combatState, clearCombatAndApplyState, tieBreakerState, submitTieChoice, makeMove } = useGame();
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

  const handleCellClick = (row, col) => {
    if (gameOver || tieBreakerState) return;

    const cell = gameState?.grid[row]?.[col];
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
  };

  if (!hasValidGame) {
    return (
      <div className="inline-flex flex-col rounded-lg overflow-hidden shadow-lg border border-stone-200 dark:border-stone-700 p-4 bg-stone-50 dark:bg-stone-800/50">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Waiting for opponent to join...
        </p>
      </div>
    );
  }

  const { grid, currentTurn } = gameState;
  const myTurn = currentTurn === playerId;

  return (
    <div className="relative flex flex-col items-center gap-4">
      <p className="text-sm font-medium">
        {myTurn ? (
          <span className="text-green-600 dark:text-green-400">🟢 Your Turn</span>
        ) : (
          <span className="text-red-600 dark:text-red-400">🔴 Opponent Turn</span>
        )}
      </p>

      <div className={`relative w-[95vw] max-w-lg aspect-square flex flex-col rounded-lg overflow-hidden shadow-lg border-2 border-stone-300 dark:border-stone-600 ${tieBreakerState ? 'pointer-events-none' : ''}`}>
        <CombatModal combatState={combatState} playerId={playerId} onComplete={clearCombatAndApplyState} />
        <TieBreakerModal tieBreakerState={tieBreakerState} onSubmitChoice={submitTieChoice} />
        {gameOver && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-lg">
            <div className="bg-white dark:bg-stone-800 p-6 rounded-xl shadow-xl text-center max-w-xs">
              <p className="text-xl font-bold">
                {gameOver.winnerId === playerId ? (
                  gameOver.flagCapture ? (
                    <>🚩 You captured the flag!<br />🏆 You Win!</>
                  ) : (
                    '🏆 You Win!'
                  )
                ) : (
                  gameOver.flagCapture ? (
                    <>😔 Your flag was captured.<br />You Lose</>
                  ) : (
                    '😔 You Lose'
                  )
                )}
              </p>
            </div>
          </div>
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

              const isCheckeredLight = (row + col) % 2 === 0;
              let bgClass = isCheckeredLight ? 'bg-green-600' : 'bg-green-700';
              if (isValidMove) bgClass = 'bg-yellow-300 dark:bg-yellow-600/80';
              if (isSelected) bgClass += ' ring-2 ring-amber-500 ring-offset-1';

              const isMyMobileUnit = isMyUnit && cell && !IMMOBILE_TYPES.includes(cell.type);
              const canMoveThisTurn = isMyMobileUnit && myTurn;
              if (canMoveThisTurn && !isSelected) bgClass += ' ring-2 ring-amber-400 ring-offset-1';

              const isRevealed = cell?.revealed === true && isMyUnit;

              const imagePath = cell ? getUnitImagePath(cell) : null;
              const isHidden = cell?.type === 'hidden';

              const imgProps = {
                src: imagePath,
                alt: cell?.type === 'hidden' ? 'Unknown unit' : cell?.type ?? 'Unit',
                className: 'w-full h-full object-contain drop-shadow-lg',
                style: isEnemyUnit ? { filter: 'hue-rotate(180deg) brightness(90%)' } : undefined,
              };

              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleCellClick(row, col)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleCellClick(row, col);
                  }}
                  className={`${TILE_BASE} border border-green-800/50 ${bgClass} relative ${isRevealed ? 'ring-1 ring-sky-400/70 ring-inset' : ''}`}
                  data-row={row}
                  data-col={col}
                >
                  {isRevealed && (
                    <span className="absolute top-0 right-0 text-[8px] sm:text-[10px] leading-none bg-sky-500/80 text-white rounded-bl px-0.5" title="Revealed to enemy">👁</span>
                  )}
                  {imagePath && (
                    isHidden ? (
                      <motion.img
                        {...imgProps}
                        animate={{
                          scale: [1, 1.05, 1],
                          rotate: [-2, 2, -2],
                        }}
                        transition={{
                          duration: 2.5,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      />
                    ) : (
                      <img {...imgProps} />
                    )
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}