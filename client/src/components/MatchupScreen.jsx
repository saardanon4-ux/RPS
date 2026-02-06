import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function PlayerCard({ player, align = 'left' }) {
  const name = player?.name ?? 'שחקן';
  const teamName = player?.teamName ?? 'קבוצה לא ידועה';
  const teamColor = player?.teamColor ?? '#64748b';

  const isLeft = align === 'left';

  return (
    <motion.div
      initial={{ x: isLeft ? -80 : 80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: isLeft ? -40 : 40, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 180, damping: 20 }}
      className={`flex flex-col items-${isLeft ? 'start' : 'end'} gap-4`}
    >
      <div
        className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 shadow-2xl flex items-center justify-center overflow-hidden"
        style={{
          borderColor: '#ffffff',
          boxShadow: `0 0 40px ${teamColor}cc`,
          background: `radial-gradient(circle at 30% 20%, ${teamColor}aa, transparent 60%), radial-gradient(circle at 70% 80%, ${teamColor}77, transparent 60%)`,
        }}
      >
        <div className="absolute inset-0 bg-black/30" />
        <span className="relative text-3xl sm:text-4xl font-black text-white drop-shadow-[0_0_18px_rgba(0,0,0,0.9)]">
          {name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className={`flex flex-col gap-1 ${isLeft ? 'items-start' : 'items-end'}`}>
        <span className="text-lg sm:text-2xl font-extrabold tracking-wide text-white drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]">
          {name}
        </span>
        <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-white/80">
          <span
            className="inline-block w-3 h-3 rounded-full border border-white/70 shadow-md"
            style={{ backgroundColor: teamColor }}
          />
          <span className="uppercase tracking-widest">{teamName}</span>
        </span>
      </div>
    </motion.div>
  );
}

export default function MatchupScreen({ player1, player2, visible, onComplete }) {
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => {
      onComplete?.();
    }, 3000);
    return () => clearTimeout(id);
  }, [visible, onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 opacity-95" />
          <div className="absolute inset-0 backdrop-blur-xl" />

          <motion.div
            className="relative w-full max-w-4xl flex items-center justify-between gap-6 sm:gap-10"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.35, type: 'spring', stiffness: 150, damping: 18 }}
          >
            <PlayerCard player={player1} align="left" />

            <motion.div
              className="flex flex-col items-center gap-1"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.1 }}
            >
              <motion.span
                className="text-4xl sm:text-6xl font-black tracking-[0.35em] text-amber-300 drop-shadow-[0_0_20px_rgba(251,191,36,0.7)]"
                initial={{ y: -40 }}
                animate={{ y: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              >
                VS
              </motion.span>
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-white/60">
                מפגש מהיר
              </span>
            </motion.div>

            <PlayerCard player={player2} align="right" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

