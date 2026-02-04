import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

const VIDEO_DURATION_MS = 4000;

export default function FlagCaptureCelebration({ won, onComplete, rematchRequested, requestRematch, playerId }) {
  const iRequested = rematchRequested?.[playerId];
  const otherRequested = Object.keys(rematchRequested ?? {}).some((id) => id !== playerId && rematchRequested[id]);
  const bothReady = iRequested && otherRequested;
  const [showVideo, setShowVideo] = useState(won);

  useEffect(() => {
    if (won) {
      setShowVideo(true);
      const t = setTimeout(() => setShowVideo(false), VIDEO_DURATION_MS);
      return () => clearTimeout(t);
    }
  }, [won]);

  useEffect(() => {
    if (won) {
      const duration = 3000;
      const end = Date.now() + duration;
      const fire = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#22c55e', '#eab308', '#ef4444', '#3b82f6', '#a855f7'],
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#22c55e', '#eab308', '#ef4444', '#3b82f6', '#a855f7'],
        });
        if (Date.now() < end) setTimeout(fire, 200);
      };
      fire();
      setTimeout(() => confetti({ particleCount: 100, spread: 100, origin: { y: 0.6 } }), 100);
    }
  }, [won]);

  useEffect(() => {
    const done = setTimeout(onComplete, VIDEO_DURATION_MS + 4500);
    return () => clearTimeout(done);
  }, [onComplete]);

  if (won) {
    return (
      <motion.div
        className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-lg overflow-hidden touch-manipulation"
        style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <AnimatePresence mode="wait">
          {showVideo ? (
            <motion.div
              key="video"
              className="flex items-center justify-center w-full max-w-md aspect-video pointer-events-none"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <video
                src="/assets/capture_flag.mp4"
                autoPlay
                muted
                loop={false}
                playsInline
                className="w-full h-full object-contain"
              />
            </motion.div>
          ) : (
            <motion.div
              key="victory"
              className="relative z-10 text-center px-6 py-12"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
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
          <button
            type="button"
            onClick={requestRematch}
            disabled={iRequested}
            className="mt-6 w-full min-h-[48px] px-4 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-amber-600 disabled:cursor-default text-white font-medium transition-colors touch-manipulation active:scale-[0.98]"
          >
            {bothReady ? 'Starting rematch...' : iRequested ? 'Waiting for opponent...' : 'Rematch'}
          </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center rounded-lg overflow-hidden touch-manipulation"
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
        <button
          type="button"
          onClick={requestRematch}
          disabled={iRequested}
          className="mt-6 w-full min-h-[48px] px-4 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-amber-600 disabled:cursor-default text-white font-medium transition-colors touch-manipulation active:scale-[0.98]"
        >
          {bothReady ? 'Starting rematch...' : iRequested ? 'Waiting for opponent...' : 'Rematch'}
        </button>
      </motion.div>
    </motion.div>
  );
}
