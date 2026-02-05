import { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext';

const GRID_SIZE = 6;

const UNIT_EMOJI = {
  rock: '🪨',
  paper: '📄',
  scissors: '✂️',
  flag: '🚩',
  trap: '🪤',
};

const PALETTE_TYPES = [
  { type: 'rock', label: 'Rock', emoji: '🪨', limit: null },
  { type: 'paper', label: 'Paper', emoji: '📄', limit: null },
  { type: 'scissors', label: 'Scissors', emoji: '✂️', limit: null },
  { type: 'flag', label: 'Flag', emoji: '🚩', limit: 1 },
  { type: 'trap', label: 'Trap', emoji: '🪤', limit: 1 },
];

const TILE_BASE =
  'aspect-square min-w-[40px] min-h-[40px] sm:min-w-[52px] sm:min-h-[52px] flex items-center justify-center border text-xl sm:text-2xl font-medium transition-colors cursor-pointer select-none';

export default function SetupBoard() {
  const {
    player,
    setupPhase,
    setupGrid,
    setupReady,
    setupTimer,
    placeUnit,
    removeUnit,
    randomizeSetup,
    setupReadySubmit,
  } = useGame();

  const [selectedType, setSelectedType] = useState(null);

  const mySlots =
    player?.side === 'bottom'
      ? [
          [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5],
          [5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5],
        ]
      : [
          [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
          [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5],
        ];

  const placedCounts = useMemo(() => {
    const counts = { rock: 0, paper: 0, scissors: 0, flag: 0, trap: 0 };
    const grid = setupGrid ?? [];
    mySlots.forEach(([r, c]) => {
      const cell = grid[r]?.[c];
      if (cell?.type) counts[cell.type]++;
    });
    return counts;
  }, [setupGrid, mySlots]);

  const isMyCell = (row, col) => mySlots.some(([r, c]) => r === row && c === col);
  const canPlace = (row, col) => isMyCell(row, col) && !setupGrid?.[row]?.[col];
  const canPlaceType = (type) => {
    const counts = placedCounts;
    const total = counts.rock + counts.paper + counts.scissors + counts.flag + counts.trap;
    if (total >= 12) return false;
    if (type === 'flag') return counts.flag < 1;
    if (type === 'trap') return counts.trap < 1;
    const rps = counts.rock + counts.paper + counts.scissors;
    return rps < 10;
  };

  const allPlaced =
    placedCounts.flag === 1 &&
    placedCounts.trap === 1 &&
    placedCounts.rock + placedCounts.paper + placedCounts.scissors === 10;

  const handleCellClick = (row, col) => {
    const cell = setupGrid?.[row]?.[col];
    if (cell) {
      removeUnit(row, col);
      setSelectedType(null);
      return;
    }
    if (selectedType && canPlace(row, col) && canPlaceType(selectedType)) {
      placeUnit(row, col, selectedType);
    }
  };

  const handlePaletteClick = (type) => {
    if (!canPlaceType(type)) return;
    setSelectedType((prev) => (prev === type ? null : type));
  };

  if (!setupPhase) return null;

  const grid = setupGrid ?? Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-lg">
      <p className="text-sm text-white/70">
        {setupTimer !== null ? `${setupTimer}s left` : 'Setup'}
      </p>

      {/* Grid with slot styling */}
      <div
        className="relative inline-flex flex-col rounded-lg overflow-hidden shadow-inner border-2 border-stone-400 dark:border-stone-600 bg-stone-200/50 dark:bg-stone-800/50 p-1"
        style={player?.side === 'top' ? { transform: 'rotate(180deg)' } : undefined}
      >
        {Array.from({ length: GRID_SIZE }, (_, row) => (
          <div key={row} className="flex">
            {Array.from({ length: GRID_SIZE }, (_, col) => {
              const cell = grid[row]?.[col];
              const placeable = canPlace(row, col);
              const isSelectedTarget = selectedType && placeable && canPlaceType(selectedType);

              let bgClass =
                'bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]';
              if (cell)
                bgClass =
                  'bg-blue-100 dark:bg-blue-900/60 border border-blue-400 dark:border-blue-600 shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]';
              if (placeable) bgClass += ' hover:bg-stone-200 dark:hover:bg-stone-700';
              if (isSelectedTarget)
                bgClass =
                  'bg-yellow-200 dark:bg-yellow-700/60 border-2 border-yellow-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]';

              const display = cell?.type ? UNIT_EMOJI[cell.type] ?? '?' : null;

              return (
                <div
                  key={`${row}-${col}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleCellClick(row, col)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleCellClick(row, col);
                  }}
                  className={`${TILE_BASE} rounded-sm ${bgClass}`}
                  style={player?.side === 'top' ? { transform: 'rotate(180deg)' } : undefined}
                >
                  {display}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Unit Palette */}
      <div className="w-full">
        <p className="text-sm text-white/60 mb-2 text-center">
          Select type, then click a slot. Click placed unit to remove.
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {PALETTE_TYPES.map(({ type, label, emoji, limit }) => {
            const count = placedCounts[type];
            const disabled = limit !== null && count >= limit;
            const rpsTotal = placedCounts.rock + placedCounts.paper + placedCounts.scissors;
            const rpsDisabled = ['rock', 'paper', 'scissors'].includes(type) && rpsTotal >= 10;
            const isDisabled = disabled || rpsDisabled;
            const isSpecial = type === 'flag' || type === 'trap';

            return (
              <button
                key={type}
                type="button"
                onClick={() => handlePaletteClick(type)}
                disabled={isDisabled}
                className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl border-2 font-medium transition-all ${
                  selectedType === type
                    ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/50 scale-105'
                    : isDisabled
                      ? 'border-stone-300 dark:border-stone-600 bg-stone-100 dark:bg-stone-800/50 opacity-60 cursor-not-allowed'
                      : isSpecial
                        ? 'border-emerald-500 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 hover:border-emerald-400'
                        : 'border-stone-400 dark:border-stone-500 bg-stone-100 dark:bg-stone-800 hover:border-amber-400'
                }`}
              >
                <span className="text-2xl">{emoji}</span>
                <span className="text-xs text-white/60">
                  {label}
                  {limit !== null ? ` (${count}/${limit})` : ` (${count})`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={randomizeSetup}
          className="px-4 py-2 rounded-lg bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 font-medium transition-colors"
        >
          Randomize (fill empty)
        </button>
        <button
          type="button"
          onClick={setupReadySubmit}
          disabled={!allPlaced}
          className="px-6 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-stone-400 disabled:cursor-not-allowed font-medium text-white transition-colors"
        >
          Ready
        </button>
      </div>

      {setupReady && Object.keys(setupReady).length > 0 && (
        <p className="text-sm text-white/70">
          Ready: {Object.entries(setupReady).filter(([, r]) => r).length}/2
        </p>
      )}
    </div>
  );
}
