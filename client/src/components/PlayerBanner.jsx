import { motion } from 'framer-motion';

function Avatar({ name, isOpponent }) {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  return (
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${
        isOpponent
          ? 'bg-gradient-to-br from-rose-500/30 to-red-600/40 border border-rose-400/50 text-rose-200'
          : 'bg-gradient-to-br from-cyan-500/30 to-blue-600/40 border border-cyan-400/50 text-cyan-200'
      }`}
    >
      {initial}
    </div>
  );
}

export default function PlayerBanner({ nickname, isOpponent, isTheirTurn, position }) {
  return (
    <motion.div
      className={`
        flex items-center gap-3 px-4 py-2.5 rounded-2xl backdrop-blur-xl border transition-all duration-300
        ${position === 'top' ? 'flex-row' : 'flex-row-reverse'}
        ${isTheirTurn
          ? 'bg-white/15 border-amber-400/60 shadow-[0_0_20px_rgba(251,191,36,0.25)]'
          : 'bg-white/5 border-white/10 opacity-75'
        }
      `}
      animate={isTheirTurn ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 2, repeat: isTheirTurn ? Infinity : 0, ease: 'easeInOut' }}
    >
      <Avatar name={nickname} isOpponent={isOpponent} />
      <div className={`flex flex-col ${position === 'bottom' ? 'items-end' : 'items-start'}`}>
        <span className="text-white/90 font-semibold text-sm truncate max-w-[120px]">
          {nickname || (isOpponent ? 'Opponent' : 'You')}
        </span>
        {isTheirTurn && (
          <span className="text-amber-400 text-xs font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            {isOpponent ? 'Their turn' : 'Your turn'}
          </span>
        )}
      </div>
    </motion.div>
  );
}
