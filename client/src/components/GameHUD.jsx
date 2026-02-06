import { motion } from 'framer-motion';

function normalizeHex(color) {
  if (!color) return '';
  return String(color).replace(/^#/, '').toLowerCase().padEnd(6, '0').slice(0, 6);
}

function PlayerSlot({ player, isCurrentTurn, isLocal, emoji, forceColorSwap }) {
  const name = player?.name || (isLocal ? 'אתה' : 'יריב');
  const teamName = player?.teamName || null;
  const teamColor = player?.teamColor || null;
  const wins = player?.wins ?? 0;
  const losses = player?.losses ?? 0;
  const total = wins + losses || 1;
  const winRate = Math.round((wins / total) * 100);
  const initial = name ? name.charAt(0).toUpperCase() : '?';

  const avatarBg = forceColorSwap ? '#3b82f6' : (teamColor || 'rgba(15,23,42,0.8)');
  const dotColor = forceColorSwap ? '#60a5fa' : (teamColor || '#64748b');

  return (
    <motion.div
      className={`flex flex-row items-center gap-2 px-2 py-1.5 rounded-xl transition-all duration-300 min-w-0 flex-1 ${
        isCurrentTurn ? 'opacity-100' : 'opacity-50'
      }`}
      animate={isCurrentTurn ? { scale: 1.02 } : { scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold shrink-0 border border-white/20 text-white/95"
        style={{
          background: avatarBg,
          boxShadow: isCurrentTurn ? '0 0 12px rgba(52,211,153,0.5)' : undefined,
        }}
      >
        {initial}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span
          className={`font-semibold text-xs sm:text-sm truncate ${
            isCurrentTurn ? 'text-emerald-300' : 'text-white/80'
          }`}
          style={isCurrentTurn ? { textShadow: '0 0 12px rgba(52,211,153,0.6)' } : undefined}
        >
          {name}
        </span>
        {teamName && (
          <span className="text-[10px] text-white/65 truncate flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full border border-white/60 shrink-0"
              style={{ backgroundColor: dotColor }}
            />
            <span className="truncate">{teamName}</span>
          </span>
        )}
        <span className="text-[10px] text-white/60 truncate" title={`${wins} נצחונות / ${losses} הפסדים`}>
          🏆 {winRate}%
        </span>
        {emoji && (
          <span className="text-base leading-none drop-shadow-[0_0_8px_rgba(0,0,0,0.6)] animate-bounce">
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
  const localPlayer = players.find((p) => p.id === localPlayerId);
  const opponent = players.find((p) => p.id !== localPlayerId);
  const myTeamColor = localPlayer?.teamColor || '';
  const opponentTeamColor = opponent?.teamColor || '';
  const isClash = normalizeHex(myTeamColor) === normalizeHex(opponentTeamColor);

  const p1Emoji = player1 ? emojiReactions?.[player1.id]?.emoji : null;
  const p2Emoji = player2 ? emojiReactions?.[player2.id]?.emoji : null;

  return (
    <div className="flex flex-row items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 w-full max-w-2xl min-w-0">
      <PlayerSlot
        player={player1}
        isCurrentTurn={!gameOver && currentTurn === player1?.id}
        isLocal={localPlayerId === player1?.id}
        emoji={p1Emoji}
        forceColorSwap={isClash && localPlayerId !== player1?.id}
      />
      <div className="flex flex-col items-center gap-0.5 shrink-0 min-w-[80px] sm:min-w-[100px]">
        {gameOver ? (
          <span className="text-xs font-medium text-amber-400">Game Over</span>
        ) : turnRemaining != null ? (
          <>
            <span className="text-base sm:text-lg font-bold tabular-nums text-white/90">{Math.round(turnRemaining)}s</span>
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
        forceColorSwap={isClash && localPlayerId !== player2?.id}
      />
    </div>
  );
}
