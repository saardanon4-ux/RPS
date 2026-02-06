import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const RPS_OPTIONS = [
  { type: 'rock', label: 'אבן', src: '/assets/unit-rock.png' },
  { type: 'paper', label: 'נייר', src: '/assets/unit-paper.png' },
  { type: 'scissors', label: 'מספריים', src: '/assets/unit-scissors.png' },
];

export default function TieBreakerModal({ tieBreakerState, isPlayer2, onSubmitChoice, lastTieCombat }) {
  const [countdown, setCountdown] = useState(null);
  const [selectedChoice, setSelectedChoice] = useState(null);

  const deadline = tieBreakerState?.deadline ?? 0;
  const isRestart = tieBreakerState?.isRestart;
  const wasTimeout = tieBreakerState?.wasTimeout;

  useEffect(() => {
    if (!tieBreakerState) return;

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
  const unitType = tieBreakerState?.unitType;
  const unitLabel = unitType ? unitType[0].toUpperCase() + unitType.slice(1) : 'יחידה';
  const unitSrc = unitType ? `/assets/unit-${unitType}.png` : null;
  const lastTieType = lastTieCombat?.attackerType;
  const lastTieLabel = lastTieType ? lastTieType[0].toUpperCase() + lastTieType.slice(1) : null;
  const lastTieSrc = lastTieType ? `/assets/unit-${lastTieType}.png` : null;

  const modalContent = (
    <motion.div
      className="absolute inset-0 z-20 flex items-center justify-center px-3 pointer-events-auto"
      style={{ backdropFilter: 'blur(10px)', backgroundColor: 'rgba(0,0,0,0.7)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="flex flex-col items-center gap-4 px-4 py-5 sm:px-6 sm:py-6 bg-stone-900/95 rounded-2xl border-2 border-amber-500/50 shadow-2xl max-w-sm w-full mx-4"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
      >
        <h2 className="text-lg font-bold text-amber-400 tracking-wider">
          שובר שוויון
        </h2>
        <p className="text-stone-400 text-xs sm:text-sm text-center">
          אותה יחידה בשני הצדדים! בחר אבן, נייר או מספריים כדי לשבור את השוויון.
        </p>

        {unitSrc && (
          <div className="flex items-center justify-center gap-4 -mt-1">
            <div className="flex flex-col items-center gap-2">
              <img src={unitSrc} alt={unitLabel} className="w-12 h-12 object-contain drop-shadow-lg" />
              <span className="text-[11px] text-stone-400 font-medium">היחידה שלך</span>
            </div>
            <span className="text-stone-500 text-xs sm:text-sm font-semibold">נגד</span>
            <div className="flex flex-col items-center gap-2">
              <img src={unitSrc} alt={unitLabel} className="w-12 h-12 object-contain drop-shadow-lg" />
              <span className="text-[11px] text-stone-400 font-medium">היריב</span>
            </div>
          </div>
        )}

        {(isRestart || wasTimeout) && (
          <div className="flex flex-col items-center gap-1 -mt-1">
            <p className="text-sm sm:text-base font-bold text-amber-400 text-center">
              {wasTimeout ? 'הזמן נגמר! בחר מחדש' : 'תיקו — בחרו שוב'}
            </p>
            {!wasTimeout && lastTieSrc && (
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-2">
                  <img src={lastTieSrc} alt={lastTieLabel ?? 'Your choice'} className="w-10 h-10 object-contain drop-shadow-lg" />
                  <span className="text-[11px] text-stone-400 font-medium">אתה</span>
                </div>
                <span className="text-stone-500 text-sm font-semibold">נגד</span>
                <div className="flex items-center gap-2">
                  <img src={lastTieSrc} alt={lastTieLabel ?? 'Opponent choice'} className="w-10 h-10 object-contain drop-shadow-lg" />
                  <span className="text-[11px] text-stone-400 font-medium">היריב</span>
                </div>
              </div>
            )}
          </div>
        )}

        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {countdown !== null && countdown > 0 && (
            <span className="text-xl sm:text-2xl font-bold text-amber-400 tabular-nums">
              {countdown} שניות
            </span>
          )}
          <div className="flex gap-2 justify-between w-full max-w-xs">
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
                className={`relative flex flex-col items-center justify-center gap-1.5 p-3 min-h-[70px] min-w-[70px] rounded-xl border-2 transition-all touch-manipulation ${
                  isSelected
                    ? 'bg-amber-600/80 border-amber-400 ring-4 ring-amber-400/70 ring-offset-2 ring-offset-stone-900 shadow-lg shadow-amber-500/30'
                    : 'bg-stone-800 hover:bg-stone-700 active:bg-stone-600 border-stone-600 hover:border-amber-500/60'
                }`}
                whileHover={!isSelected ? { scale: 1.05 } : {}}
                whileTap={{ scale: 0.98 }}
              >
                <img src={opt.src} alt={opt.label} className="w-10 h-10 object-contain drop-shadow-lg" />
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
      </motion.div>
    </motion.div>
  );

  if (isPlayer2) {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ transform: 'rotate(180deg)' }}>
        {modalContent}
      </div>
    );
  }
  return modalContent;
}
