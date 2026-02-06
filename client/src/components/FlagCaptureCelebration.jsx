import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

const VIDEO_DURATION_MS = 4000;

const WIN_LABELS = {
  flag: { title: 'FLAG CAPTURED!', sub: '🏆 YOU WIN! 🏆', icon: '🚩' },
  no_units: { title: 'VICTORY!', sub: '🏆 YOU WIN! 🏆', icon: '🏆' },
};
const LOSE_LABELS = {
  flag: { title: 'Your flag was captured', sub: '😔 You Lose', icon: '🚩' },
  no_units: { title: 'All your units were destroyed', sub: '😔 You Lose', icon: '💥' },
};

function wrapForPlayer2(content, isPlayer2) {
  if (!isPlayer2) return content;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ transform: 'rotate(180deg)' }}>
      {content}
    </div>
  );
}

export default function FlagCaptureCelebration({ won, winType = 'flag', onComplete, rematchRequested, requestRematch, playerId, isPlayer2, disconnectWin, opponentConnected }) {
  const iRequested = rematchRequested?.[playerId];
  const otherRequested = Object.keys(rematchRequested ?? {}).some((id) => id !== playerId && rematchRequested[id]);
  const bothReady = iRequested && otherRequested;
  const [showVideo, setShowVideo] = useState(won);
  const videoRef = useRef(null);

  useEffect(() => {
    if (won) {
      setShowVideo(true);
      const t = setTimeout(() => setShowVideo(false), VIDEO_DURATION_MS);
      return () => clearTimeout(t);
    }
  }, [won]);

  // Force play in browsers that show first frame only.
  useEffect(() => {
    if (!showVideo) return;
    const v = videoRef.current;
    if (!v) return;
    const tryPlay = async () => {
      try {
        v.muted = true;
        await v.play();
      } catch {
        // ignore autoplay blocks; user still sees the video container
      }
    };
    tryPlay();
  }, [showVideo]);

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
    const winContent = (
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
                ref={videoRef}
                src="/assets/capture_flag.mp4"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
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
            {WIN_LABELS[winType]?.icon ?? WIN_LABELS.flag.icon}
          </motion.div>
          <motion.p
            className="text-3xl sm:text-4xl font-black text-amber-400 uppercase tracking-widest drop-shadow-lg"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 0.6 }}
          >
            {WIN_LABELS[winType]?.title ?? WIN_LABELS.flag.title}
          </motion.p>
          <motion.p
            className="text-4xl sm:text-5xl font-black text-green-400 mt-4"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {WIN_LABELS[winType]?.sub ?? WIN_LABELS.flag.sub}
          </motion.p>
          <motion.div
            className="flex justify-center gap-4 mt-6 text-4xl"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.3 }}
          >
            🎉🎊🥳🎉🎊
          </motion.div>
          {!disconnectWin && opponentConnected && (
            <button
              type="button"
              onClick={requestRematch}
              disabled={iRequested}
              className="mt-6 w-full min-h-[48px] px-4 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-amber-600 disabled:cursor-default text-white font-medium transition-colors touch-manipulation active:scale-[0.98]"
            >
              {bothReady ? 'Starting rematch...' : iRequested ? 'Waiting for opponent...' : 'Rematch'}
            </button>
          )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
    return wrapForPlayer2(winContent, isPlayer2);
  }

  const loseContent = (
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
          {LOSE_LABELS[winType]?.icon ?? LOSE_LABELS.flag.icon}
        </motion.p>
        <p className="text-xl font-bold text-stone-400">{LOSE_LABELS[winType]?.title ?? LOSE_LABELS.flag.title}</p>
        <p className="text-2xl font-black text-red-500 mt-2">{LOSE_LABELS[winType]?.sub ?? LOSE_LABELS.flag.sub}</p>
        {!disconnectWin && opponentConnected && (
          <button
            type="button"
            onClick={requestRematch}
            disabled={iRequested}
            className="mt-6 w-full min-h-[48px] px-4 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-amber-600 disabled:cursor-default text-white font-medium transition-colors touch-manipulation active:scale-[0.98]"
          >
            {bothReady ? 'Starting rematch...' : iRequested ? 'Waiting for opponent...' : 'Rematch'}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
  return wrapForPlayer2(loseContent, isPlayer2);
}
