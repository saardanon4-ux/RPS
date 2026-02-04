import { useEffect } from 'react';
import { motion } from 'framer-motion';

const CONFETTI_COUNT = 60;
const COLORS = ['#22c55e', '#eab308', '#ef4444', '#3b82f6', '#a855f7', '#ec4899'];

function ConfettiPiece({ delay, color, x, left }) {
  return (
    <motion.div
      className="absolute w-3 h-3 rounded-sm"
      style={{
        left: `${left}%`,
        top: '-10px',
        backgroundColor: color,
        transformOrigin: 'center bottom',
      }}
      initial={{ y: 0, rotate: 0, opacity: 1 }}
      animate={{
        y: 400,
        rotate: 720,
        opacity: [1, 1, 0],
      }}
      transition={{
        duration: 2.5,
        delay,
        ease: 'easeIn',
      }}
    />
  );
}

export default function FlagCaptureCelebration({ won, onComplete }) {

  useEffect(() => {
    const done = setTimeout(onComplete, 4500);
    return () => clearTimeout(done);
  }, [onComplete]);

  if (won) {
    return (
      <motion.div
        className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-lg overflow-hidden"
        style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
            <ConfettiPiece
              key={i}
              delay={i * 0.02 + Math.random() * 0.1}
              color={COLORS[i % COLORS.length]}
              left={Math.random() * 100}
            />
          ))}
        </div>
        <motion.div
          className="relative z-10 text-center px-6 py-12"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <motion.div
            animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
            transition={{ duration: 0.5, repeat: 2, repeatDelay: 0.2 }}
            className="text-7xl sm:text-8xl mb-4"
          >
            🚩
          </motion.div>
          <motion.p
            className="text-3xl sm:text-4xl font-black text-amber-400 uppercase tracking-widest drop-shadow-lg"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 0.6 }}
          >
            FLAG CAPTURED!
          </motion.p>
          <motion.p
            className="text-4xl sm:text-5xl font-black text-green-400 mt-4"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            🏆 YOU WIN! 🏆
          </motion.p>
          <motion.div
            className="flex justify-center gap-4 mt-6 text-4xl"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.3 }}
          >
            🎉🎊🥳🎉🎊
          </motion.div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center rounded-lg overflow-hidden"
      style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.5)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="text-center px-6 py-12 bg-stone-900/90 rounded-2xl border-2 border-stone-600"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 150 }}
      >
        <motion.p className="text-5xl mb-4" animate={{ y: [0, -5, 0] }} transition={{ duration: 1, repeat: Infinity }}>
          🚩
        </motion.p>
        <p className="text-xl font-bold text-stone-400">Your flag was captured</p>
        <p className="text-2xl font-black text-red-500 mt-2">😔 You Lose</p>
      </motion.div>
    </motion.div>
  );
}
