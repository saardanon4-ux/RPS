import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const RPS_OPTIONS = [
  { type: 'rock', label: 'Rock', src: '/assets/unit-rock.png' },
  { type: 'paper', label: 'Paper', src: '/assets/unit-paper.png' },
  { type: 'scissors', label: 'Scissors', src: '/assets/unit-scissors.png' },
];

export default function TieBreakerModal({ tieBreakerState, onSubmitChoice }) {
  const [countdown, setCountdown] = useState(null);
  const [showTieAgain, setShowTieAgain] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState(null);

  const deadline = tieBreakerState?.deadline ?? 0;
  const isRestart = tieBreakerState?.isRestart;
  const wasTimeout = tieBreakerState?.wasTimeout;

  useEffect(() => {
    if (!tieBreakerState) return;

    if (isRestart) {
      setShowTieAgain(true);
      setSelectedChoice(null);
      const t = setTimeout(() => setShowTieAgain(false), 1200);
      return () => clearTimeout(t);
    }
    setSelectedChoice(null);

    const tick = () => {
      const remain = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setCountdown(remain);
      if (remain > 0) {
        requestAnimationFrame(tick);
      }
    };
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [tieBreakerState, deadline, isRestart]);

  if (!tieBreakerState) return null;

  return (
    <motion.div
      className="absolute inset-0 z-20 flex items-center justify-center rounded-lg overflow-hidden pointer-events-auto"
      style={{ backdropFilter: 'blur(10px)', backgroundColor: 'rgba(0,0,0,0.7)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="flex flex-col items-center gap-6 px-8 py-10 bg-stone-900/95 rounded-2xl border-2 border-amber-500/50 shadow-2xl max-w-sm w-full mx-4"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
      >
        <h2 className="text-xl font-bold text-amber-400 uppercase tracking-wider">
          Sudden Death!
        </h2>
        <p className="text-stone-400 text-sm text-center">
          Same unit type! Pick Rock, Paper, or Scissors to break the tie.
        </p>

        <AnimatePresence mode="wait">
          {showTieAgain ? (
            <motion.p
              key="tie"
              className="text-2xl font-bold text-amber-400 text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {wasTimeout ? "Time's up! Choose again" : 'TIE! TRY AGAIN!'}
            </motion.p>
          ) : (
            <motion.div
              key="choices"
              className="flex flex-col items-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {countdown !== null && countdown > 0 && (
                <span className="text-2xl font-bold text-amber-400 tabular-nums">
                  {countdown} sec
                </span>
              )}
              <div className="flex gap-4 justify-center flex-wrap">
              {RPS_OPTIONS.map((opt) => {
                const isSelected = selectedChoice === opt.type;
                return (
                  <motion.button
                    key={opt.type}
                    type="button"
                    onClick={() => {
                      setSelectedChoice(opt.type);
                      onSubmitChoice(opt.type);
                    }}
                    className={`relative flex flex-col items-center justify-center gap-2 p-4 min-h-[80px] min-w-[80px] rounded-xl border-2 transition-all touch-manipulation ${
                      isSelected
                        ? 'bg-amber-600/80 border-amber-400 ring-4 ring-amber-400/70 ring-offset-2 ring-offset-stone-900 shadow-lg shadow-amber-500/30'
                        : 'bg-stone-800 hover:bg-stone-700 active:bg-stone-600 border-stone-600 hover:border-amber-500/60'
                    }`}
                    whileHover={!isSelected ? { scale: 1.05 } : {}}
                    whileTap={{ scale: 0.98 }}
                  >
                    <img
                      src={opt.src}
                      alt={opt.label}
                      className="w-12 h-12 object-contain drop-shadow-lg"
                    />
                    <span className={`text-xs font-medium ${isSelected ? 'text-amber-100' : 'text-stone-300'}`}>
                      {opt.label}
                    </span>
                    {isSelected && (
                      <span className="absolute -top-1 -right-1 text-amber-400 text-lg">✓</span>
                    )}
                  </motion.button>
                );
              })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
