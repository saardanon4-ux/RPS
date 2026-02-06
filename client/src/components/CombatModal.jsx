import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const UNIT_EMOJI = {
  rock: '🪨',
  paper: '📄',
  scissors: '✂️',
  flag: '🚩',
  trap: '🪤',
};

const COMBAT_DURATION_MS = 2800;

function getResultLabel(result, attackerId, playerId, attackerType, defenderType) {
  if (result === 'both_destroyed') {
    const type = attackerType || defenderType;
    const label = type ? `${UNIT_EMOJI[type] ?? type} vs ${UNIT_EMOJI[type] ?? type}` : '';
    return label ? `${label} — DRAW!` : 'DRAW!';
  }
  if (result === 'trap_kills') return attackerId === playerId ? 'STUCK!' : 'TRAPPED!';
  const iWon = result === 'attacker_wins' ? attackerId === playerId : attackerId !== playerId;
  return iWon ? 'WIN!' : 'LOSE';
}

// --- Animation variants by scenario ---

// Paper (left) wraps right; Paper (right) wraps left. Attacker=left(+5), Defender=right(-5)
const PAPER_COVERS_ROCK = {
  winnerAttacker: {
    scale: 1.5,
    x: 50,
    zIndex: 50,
    transition: { duration: 0.55, ease: 'easeOut' },
  },
  winnerDefender: {
    scale: 1.5,
    x: -50,
    zIndex: 50,
    transition: { duration: 0.55, ease: 'easeOut' },
  },
  loser: {
    scale: 0,
    opacity: 0,
    transition: { delay: 0.35, duration: 0.45, ease: 'easeIn' },
  },
};

const ROCK_SMASHES_SCISSORS = {
  winner: {
    x: 0,
    scale: [1, 1.35, 1.15],
    y: [0, -25, 40],
    transition: { duration: 0.5, times: [0, 0.25, 1], ease: 'easeOut' },
  },
  loser: {
    rotate: 90,
    x: [0, 70],
    y: [0, -30],
    scale: [1, 0.5, 0.3],
    opacity: [1, 0.8, 0],
    transition: { duration: 0.55, delay: 0.15 },
  },
};

const SCISSORS_CUTS_PAPER = {
  winner: {
    rotate: [0, -30, 30, -25, 25, 0],
    scale: [1, 1.25, 1.15],
    transition: { duration: 0.5, times: [0, 0.12, 0.28, 0.42, 0.58, 1] },
  },
  loser: {
    opacity: [1, 0.7, 0],
    scale: [1, 1.15, 0.4],
    x: [0, -20],
    transition: { duration: 0.35, delay: 0.1 },
  },
};

function ScissorsFragments({ visible }) {
  const offsets = [
    { x: -45, y: -30, rotate: -35 },
    { x: 50, y: -35, rotate: 25 },
    { x: -30, y: 40, rotate: 20 },
    { x: 40, y: 30, rotate: -30 },
  ];
  if (!visible) return null;
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {offsets.map((o, i) => (
        <motion.span
          key={i}
          className="absolute text-2xl"
          initial={{ scale: 0.3, x: 0, y: 0, opacity: 1 }}
          animate={{
            scale: [0.3, 0.7, 0.4],
            x: o.x,
            y: o.y,
            rotate: o.rotate,
            opacity: [1, 0.8, 0],
          }}
          transition={{ duration: 0.55, delay: 0.05 }}
        >
          ✂️
        </motion.span>
      ))}
    </div>
  );
}

function PaperPieces({ visible }) {
  const pieces = [
    { x: -40, y: -25, rotate: -50 },
    { x: 45, y: -30, rotate: 35 },
    { x: -25, y: 35, rotate: 25 },
    { x: 35, y: 30, rotate: -45 },
  ];
  if (!visible) return null;
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {pieces.map((o, i) => (
        <motion.span
          key={i}
          className="absolute text-2xl"
          initial={{ scale: 0.4, x: 0, y: 0, opacity: 1 }}
          animate={{
            scale: [0.4, 0.8, 0.5],
            x: o.x,
            y: o.y,
            rotate: o.rotate,
            opacity: [1, 0.7, 0],
          }}
          transition={{ duration: 0.55, delay: 0.05 }}
        >
          📄
        </motion.span>
      ))}
    </div>
  );
}

function getAnimationVariant(winnerMove, loserMove, unitType, isAttacker) {
  const isWinner = unitType === winnerMove;
  if (winnerMove === 'paper' && loserMove === 'rock') {
    if (isWinner) return isAttacker ? PAPER_COVERS_ROCK.winnerAttacker : PAPER_COVERS_ROCK.winnerDefender;
    return PAPER_COVERS_ROCK.loser;
  }
  if (winnerMove === 'rock' && loserMove === 'scissors') {
    return isWinner ? ROCK_SMASHES_SCISSORS.winner : ROCK_SMASHES_SCISSORS.loser;
  }
  if (winnerMove === 'scissors' && loserMove === 'paper') {
    return isWinner ? SCISSORS_CUTS_PAPER.winner : SCISSORS_CUTS_PAPER.loser;
  }
  return null;
}

export default function CombatModal({ combatState, playerId, isPlayer2, onComplete }) {
  const [phase, setPhase] = useState('approach');

  useEffect(() => {
    if (!combatState) return;
    setPhase('approach');
    const clashT = setTimeout(() => setPhase('clash'), 700);
    const impactT = setTimeout(() => setPhase('impact'), 1200);
    const doneT = setTimeout(onComplete, COMBAT_DURATION_MS);
    return () => {
      clearTimeout(clashT);
      clearTimeout(impactT);
      clearTimeout(doneT);
    };
  }, [combatState, onComplete]);

  if (!combatState) return null;

  const { attackerType, defenderType, result, fromRow, fromCol, toRow, toCol } = combatState;
  const attackerEmoji = UNIT_EMOJI[attackerType] ?? '?';
  const defenderEmoji = UNIT_EMOJI[defenderType] ?? '?';
  const combatKey = `${attackerType}-${defenderType}-${result}-${combatState.attackerId}-${fromRow}-${fromCol}-${toRow}-${toCol}`;

  const attackerWins = result === 'attacker_wins';
  const defenderWins = result === 'defender_wins';
  const bothDestroyed = result === 'both_destroyed';
  const isTrap = result === 'trap_kills';

  const leftLabel = combatState.attackerId === playerId ? 'Your unit' : 'Opponent';
  const rightLabel = combatState.attackerId === playerId ? 'Opponent' : 'Your unit';

  const resultLabel = getResultLabel(result, combatState.attackerId, playerId, attackerType, defenderType);

  const winnerType = attackerWins ? attackerType : defenderType;
  const loserType = attackerWins ? defenderType : attackerType;
  const paperCoversRock = winnerType === 'paper' && loserType === 'rock';
  const rockSmashesScissors = winnerType === 'rock' && loserType === 'scissors';
  const scissorsCutsPaper = winnerType === 'scissors' && loserType === 'paper';

  const attackerVariant = getAnimationVariant(winnerType, loserType, attackerType, true);
  const defenderVariant = getAnimationVariant(winnerType, loserType, defenderType, false);

  const showScissorsFragments = rockSmashesScissors && phase === 'impact';
  const showPaperPieces = scissorsCutsPaper && phase === 'impact';

  const content = (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center rounded-lg overflow-hidden"
      style={{ backdropFilter: 'blur(10px)', backgroundColor: 'rgba(0,0,0,0.65)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      aria-live="polite"
    >
      <motion.div
        className="flex flex-col items-center gap-8 px-10 py-8 bg-stone-900/90 rounded-2xl border-2 border-amber-500/40 shadow-2xl"
        animate={phase === 'impact' && (rockSmashesScissors || isTrap) ? { x: [0, -10, 10, -6, 6, 0] } : {}}
        transition={{ duration: 0.4 }}
      >
        <motion.p
          className="text-amber-400 font-bold text-xs uppercase tracking-[0.2em]"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {isTrap ? 'Caught in a trap!' : 'Combat!'}
        </motion.p>
        <div className="flex items-center gap-4 relative min-h-[140px] w-[280px] justify-center">
          {showScissorsFragments && <ScissorsFragments visible />}
          {showPaperPieces && <PaperPieces visible />}

          {/* Left side (attacker) */}
          <motion.div
            className={`flex flex-col items-center gap-2 relative ${paperCoversRock && attackerType === 'paper' ? 'z-[50]' : 'z-10'}`}
            initial={{ x: -100, opacity: 0 }}
            animate={
              phase === 'approach' || phase === 'clash' || phase === 'impact'
                ? { x: 5, opacity: 1 }
                : { x: 5, opacity: 1 }
            }
            transition={phase === 'approach' ? { type: 'spring', stiffness: 120, damping: 18 } : {}}
          >
            <motion.span
              key={`att-${combatKey}`}
              className="block text-5xl sm:text-6xl"
              role="img"
              aria-label={attackerType}
              animate={
                phase === 'impact'
                  ? isTrap
                    ? { scale: [1, 0.8, 0.6], y: [0, 5, 10], opacity: [1, 0.8, 0] }
                    : bothDestroyed
                      ? { scale: [1, 1.4, 0], opacity: [1, 0.8, 0] }
                      : attackerVariant
                        ? attackerVariant
                        : attackerWins
                          ? { scale: [1, 1.5, 1.2] }
                          : { scale: [1, 0.5], opacity: [1, 0] }
                  : {}
              }
              transition={phase === 'impact' && attackerVariant ? {} : { duration: 0.6 }}
            >
              {attackerEmoji}
            </motion.span>
            <span className="text-xs text-stone-400 font-medium">{leftLabel}</span>
          </motion.div>

          {(phase === 'approach' || phase === 'clash') && (
            <motion.span
              className="text-xl text-stone-500 absolute"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 0.4 }}
            >
              vs
            </motion.span>
          )}

          {/* Defender - right side */}
          <motion.div
            className={`flex flex-col items-center gap-2 relative ${paperCoversRock && defenderType === 'paper' ? 'z-[50]' : 'z-10'}`}
            initial={{ x: 100, opacity: 0 }}
            animate={
              phase === 'approach' || phase === 'clash' || phase === 'impact'
                ? { x: -5, opacity: 1 }
                : { x: -5, opacity: 1 }
            }
            transition={phase === 'approach' ? { type: 'spring', stiffness: 120, damping: 18 } : {}}
          >
            {isTrap && phase === 'impact' && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {['-top-4 -left-2', '-top-4 -right-2', '-bottom-2 left-0', '-bottom-2 right-0'].map((pos, i) => (
                  <motion.span
                    key={i}
                    className={`absolute text-5xl text-emerald-600 ${pos}`}
                    initial={{ scale: 0.2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 0.95 }}
                    transition={{ duration: 0.35, delay: i * 0.05 }}
                  >
                    🌿
                  </motion.span>
                ))}
              </motion.div>
            )}
            <motion.span
              key={`def-${combatKey}`}
              className="block text-5xl sm:text-6xl relative"
              role="img"
              aria-label={defenderType}
              animate={
                phase === 'impact'
                  ? isTrap
                    ? {}
                    : bothDestroyed
                      ? { scale: [1, 1.4, 0], opacity: [1, 0.8, 0] }
                      : defenderVariant
                        ? defenderVariant
                        : defenderWins
                          ? { scale: [1, 1.5, 1.2] }
                          : { scale: [1, 0.5], opacity: [1, 0] }
                  : {}
              }
              transition={phase === 'impact' && defenderVariant ? {} : { duration: 0.6 }}
            >
              {defenderEmoji}
            </motion.span>
            <span className="text-xs text-stone-400 font-medium">
              {defenderType === 'trap' ? 'Trap!' : rightLabel}
            </span>
          </motion.div>
        </div>

        {phase === 'impact' && (
          <motion.p
            className="text-2xl sm:text-3xl font-black uppercase tracking-wider"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={{
              color:
                resultLabel === 'WIN!' ? '#22c55e'
                  : resultLabel === 'LOSE' ? '#ef4444'
                  : resultLabel === 'STUCK!' || resultLabel === 'TRAPPED!' ? '#10b981'
                  : '#f59e0b',
            }}
          >
            {resultLabel}
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );

  if (isPlayer2) {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ transform: 'rotate(180deg)' }}>
        {content}
      </div>
    );
  }
  return content;
}
