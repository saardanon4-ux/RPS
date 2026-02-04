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

function getResultLabel(result, attackerId, playerId) {
  if (result === 'both_destroyed') return 'DRAW';
  const iWon = result === 'attacker_wins' ? attackerId === playerId : attackerId !== playerId;
  return iWon ? 'WIN!' : 'LOSE';
}

function ScissorsFragments({ visible }) {
  const offsets = [
    { x: -40, y: -25, rotate: -30 },
    { x: 45, y: -30, rotate: 20 },
    { x: -25, y: 35, rotate: 15 },
    { x: 35, y: 25, rotate: -25 },
  ];
  if (!visible) return null;
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {offsets.map((o, i) => (
        <motion.span
          key={i}
          className="absolute text-2xl opacity-80"
          initial={{ scale: 0.3, x: 0, y: 0, opacity: 1 }}
          animate={{
            scale: [0.3, 0.6, 0.4],
            x: o.x,
            y: o.y,
            rotate: o.rotate,
            opacity: [1, 0.8, 0],
          }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          ✂️
        </motion.span>
      ))}
    </div>
  );
}

function PaperPieces({ visible }) {
  const pieces = [
    { x: -35, y: -20, rotate: -45 },
    { x: 40, y: -25, rotate: 30 },
    { x: -20, y: 30, rotate: 20 },
    { x: 30, y: 25, rotate: -40 },
  ];
  if (!visible) return null;
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {pieces.map((o, i) => (
        <motion.span
          key={i}
          className="absolute text-2xl opacity-90"
          initial={{ scale: 0.4, x: 0, y: 0, opacity: 1 }}
          animate={{
            scale: [0.4, 0.7, 0.5],
            x: o.x,
            y: o.y,
            rotate: o.rotate,
            opacity: [1, 0.7, 0],
          }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          📄
        </motion.span>
      ))}
    </div>
  );
}

export default function CombatModal({ combatState, playerId, onComplete }) {
  const [phase, setPhase] = useState('approach'); // approach -> clash -> impact

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

  const { attackerType, defenderType, result } = combatState;
  const attackerEmoji = UNIT_EMOJI[attackerType] ?? '?';
  const defenderEmoji = UNIT_EMOJI[defenderType] ?? '?';

  const attackerWins = result === 'attacker_wins';
  const defenderWins = result === 'defender_wins';
  const bothDestroyed = result === 'both_destroyed';
  const isTrap = result === 'trap_kills';

  const resultLabel = getResultLabel(result, combatState.attackerId, playerId);

  const winnerType = attackerWins ? attackerType : defenderType;
  const loserType = attackerWins ? defenderType : attackerType;
  const paperWrapsRock = winnerType === 'paper' && loserType === 'rock';
  const rockSmashesScissors = winnerType === 'rock' && loserType === 'scissors';
  const scissorsCutsPaper = winnerType === 'scissors' && loserType === 'paper';

  const showScissorsFragments = rockSmashesScissors && phase === 'impact';
  const showPaperPieces = scissorsCutsPaper && phase === 'impact';

  return (
    <motion.div
      className="absolute inset-0 z-20 flex items-center justify-center rounded-lg overflow-hidden"
      style={{ backdropFilter: 'blur(10px)', backgroundColor: 'rgba(0,0,0,0.65)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      aria-live="polite"
    >
      <motion.div
        className="flex flex-col items-center gap-8 px-10 py-8 bg-stone-900/90 rounded-2xl border-2 border-amber-500/40 shadow-2xl"
        animate={phase === 'impact' ? { x: [0, -8, 8, -5, 5, 0] } : {}}
        transition={{ duration: 0.35 }}
      >
        <motion.p
          className="text-amber-400 font-bold text-xs uppercase tracking-[0.2em]"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Combat!
        </motion.p>

        <div className="flex items-center gap-4 relative min-h-[140px] w-[280px] justify-center">
          {showScissorsFragments && <ScissorsFragments visible />}
          {showPaperPieces && <PaperPieces visible />}
          {/* Attacker - approaches from left toward center */}
          <motion.div
            className={`flex flex-col items-center gap-2 relative ${paperWrapsRock && attackerType === 'paper' ? 'z-20' : 'z-10'}`}
            initial={{ x: -100, opacity: 0 }}
            animate={
              phase === 'approach' || phase === 'clash' || phase === 'impact'
                ? { x: 5, opacity: 1 }
                : { x: 5, opacity: 1 }
            }
            transition={
              phase === 'approach'
                ? { type: 'spring', stiffness: 120, damping: 18 }
                : {}
            }
          >
            <motion.span
              className="block text-5xl sm:text-6xl"
              role="img"
              aria-label={attackerType}
              animate={
                phase === 'impact'
                  ? isTrap
                    ? { scale: [1, 1.2, 0], opacity: [1, 1, 0] }
                    : bothDestroyed
                      ? { scale: [1, 1.4, 0], opacity: [1, 0.8, 0] }
                      : paperWrapsRock && attackerType === 'paper'
                        ? { scale: [1, 3.2], x: [0, 50] }
                        : paperWrapsRock && attackerType === 'rock'
                          ? { scale: [1, 0.3], opacity: [1, 0] }
                        : rockSmashesScissors && attackerType === 'rock'
                          ? { scale: [1, 2], y: [0, -15, 20] }
                        : rockSmashesScissors && attackerType === 'scissors'
                          ? { scale: [1, 0.6, 0], opacity: [1, 0.3, 0] }
                        : scissorsCutsPaper && attackerType === 'scissors'
                          ? { rotate: [0, -35, 35, -30, 30, 0], scale: [1, 1.3] }
                        : scissorsCutsPaper && attackerType === 'paper'
                          ? { scale: [1, 0.6, 0], opacity: [1, 0.3, 0] }
                        : attackerWins
                          ? { scale: [1, 1.5, 1.2] }
                          : { scale: [1, 0.5], opacity: [1, 0] }
                  : {}
              }
              transition={{ duration: 0.65 }}
            >
              {attackerEmoji}
            </motion.span>
            <span className="text-xs text-stone-400">Attacker</span>
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

          {/* Defender - approaches from right toward center */}
          <motion.div
            className={`flex flex-col items-center gap-2 relative ${paperWrapsRock && defenderType === 'paper' ? 'z-20' : 'z-10'}`}
            initial={{ x: 100, opacity: 0 }}
            animate={
              phase === 'approach' || phase === 'clash' || phase === 'impact'
                ? { x: -5, opacity: 1 }
                : { x: -5, opacity: 1 }
            }
            transition={
              phase === 'approach'
                ? { type: 'spring', stiffness: 120, damping: 18 }
                : {}
            }
          >
            {isTrap && phase === 'impact' && (
              <motion.span
                className="absolute text-6xl text-emerald-500/90 -top-2"
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 0.9 }}
                transition={{ duration: 0.4 }}
              >
                🌿
              </motion.span>
            )}
            <motion.span
              className="block text-5xl sm:text-6xl relative"
              role="img"
              aria-label={defenderType}
              animate={
                phase === 'impact'
                  ? isTrap
                    ? {}
                    : bothDestroyed
                      ? { scale: [1, 1.4, 0], opacity: [1, 0.8, 0] }
                      : paperWrapsRock && defenderType === 'paper'
                        ? { scale: [1, 3.2], x: [0, -50] }
                        : paperWrapsRock && defenderType === 'rock'
                          ? { scale: [1, 0.3], opacity: [1, 0] }
                        : rockSmashesScissors && defenderType === 'rock'
                          ? { scale: [1, 2], y: [0, -15, 20] }
                        : rockSmashesScissors && defenderType === 'scissors'
                          ? { scale: [1, 0.6, 0], opacity: [1, 0.3, 0] }
                        : scissorsCutsPaper && defenderType === 'scissors'
                          ? { rotate: [0, -35, 35, -30, 30, 0], scale: [1, 1.3] }
                        : scissorsCutsPaper && defenderType === 'paper'
                          ? { scale: [1, 0.6, 0], opacity: [1, 0.3, 0] }
                        : defenderWins
                          ? { scale: [1, 1.5, 1.2] }
                          : { scale: [1, 0.5], opacity: [1, 0] }
                  : {}
              }
              transition={{ duration: 0.65 }}
            >
              {defenderEmoji}
            </motion.span>
            <span className="text-xs text-stone-400">
              {defenderType === 'trap' ? 'Trap!' : 'Defender'}
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
                resultLabel === 'WIN!' ? '#22c55e' : resultLabel === 'LOSE' ? '#ef4444' : '#f59e0b',
            }}
          >
            {resultLabel}
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );
}
