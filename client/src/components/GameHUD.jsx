import { motion } from 'framer-motion';

function PlayerSlot({ player, isCurrentTurn, isLocal, emoji }) {
  const name = player?.name || (isLocal ? 'You' : 'Opponent');
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  return (
    <motion.div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 ${
        isCurrentTurn ? 'opacity-100' : 'opacity-50'
      }`}
      animate={isCurrentTurn ? { scale: 1.05 } : { scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
          isCurrentTurn
            ? 'bg-gradient-to-br from-emerald-500/50 to-green-600/50 border-2 border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]'
            : 'bg-white/10 border border-white/20'
        }`}
      >
        {initial}
      </div>
      <div className="flex items-center gap-1">
        <span
          className={`font-semibold text-sm truncate max-w-[80px] ${
            isCurrentTurn ? 'text-emerald-300' : 'text-white/80'
          }`}
          style={isCurrentTurn ? { textShadow: '0 0 12px rgba(52,211,153,0.6)' } : undefined}
        >
          {name}
        </span>
        {emoji && (
          <span className="text-lg leading-none drop-shadow-[0_0_8px_rgba(0,0,0,0.6)] animate-bounce">
            {emoji}
          </span>
        )}
      </div>
    </motion.div>
  );
}

export default function GameHUD({ players, currentTurn, turnRemaining, gameOver, localPlayerId, emojiReactions }) {
  const player1 = players.find((p) => p.side === 'bottom');
  const player2 = players.find((p) => p.side === 'top');

  const p1Emoji = player1 ? emojiReactions?.[player1.id]?.emoji : null;
  const p2Emoji = player2 ? emojiReactions?.[player2.id]?.emoji : null;

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 w-full max-w-2xl">
      <PlayerSlot
        player={player1}
        isCurrentTurn={!gameOver && currentTurn === player1?.id}
        isLocal={localPlayerId === player1?.id}
        emoji={p1Emoji}
      />
      <div className="flex flex-col items-center gap-0.5 min-w-[100px]">
        {gameOver ? (
          <span className="text-xs font-medium text-amber-400">Game Over</span>
        ) : turnRemaining != null ? (
          <>
            <span className="text-lg font-bold tabular-nums text-white/90">{Math.round(turnRemaining)}s</span>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(turnRemaining / 30) * 100}%`,
                  background:
                    turnRemaining > 10 ? '#22c55e' : turnRemaining > 5 ? '#eab308' : '#ef4444',
                }}
              />
            </div>
          </>
        ) : (
          <span className="text-xs text-white/60">—</span>
        )}
      </div>
      <PlayerSlot
        player={player2}
        isCurrentTurn={!gameOver && currentTurn === player2?.id}
        isLocal={localPlayerId === player2?.id}
        emoji={p2Emoji}
      />
    </div>
  );
}
