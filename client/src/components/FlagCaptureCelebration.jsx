import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getTeamColorStyle } from '../utils/colors';

const RIVALRY_FETCH_DELAY_MS = 500;
const API_BASE = import.meta.env.VITE_SERVER_URL || (typeof window !== 'undefined' ? window.location.origin : '');

const WIN_LABELS = {
  flag: { title: 'דגל היריב נכבש!', sub: '🏆 ניצחון! 🏆', icon: '🚩' },
  no_units: { title: 'כל יחידות היריב הושמדו', sub: '🏆 ניצחון! 🏆', icon: '🏆' },
};
const LOSE_LABELS = {
  flag: { title: 'הדגל שלך נכבש', sub: '😔 הפסד', icon: '🚩' },
  no_units: { title: 'כל היחידות שלך הושמדו', sub: '😔 הפסד', icon: '💥' },
};

function wrapForPlayer2(content, isPlayer2) {
  if (!isPlayer2) return content;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ transform: 'rotate(180deg)' }}>
      {content}
    </div>
  );
}

function RivalryScorecard({ myName, opponentName, myTeamColor, opponentTeamColor, wins, losses, draws }) {
  const total = wins + losses + (draws ?? 0);
  const iAmLeader = total > 0 && wins > losses;
  const theyLead = total > 0 && losses > wins;
  const myStyle = getTeamColorStyle(myTeamColor);
  const oppStyle = getTeamColorStyle(opponentTeamColor);
  return (
    <div className="w-full mt-6 mb-2 p-4 rounded-xl bg-stone-800/90 border border-stone-600">
      <p className="text-center text-stone-400 font-medium text-sm mb-3">המאזן ביניכם</p>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <div className={`flex items-center gap-2 min-w-0 ${iAmLeader ? 'text-emerald-400 font-semibold' : ''}`}>
          <div
            className="w-8 h-8 rounded-full flex-shrink-0 border-2 border-stone-500"
            style={myStyle}
            title={myName}
          />
          <span className="truncate max-w-[80px] sm:max-w-[100px]" title={myName}>{myName || 'אני'}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 font-mono text-lg">
          <span className={iAmLeader ? 'text-emerald-400 font-bold' : ''}>{wins}</span>
          <span className="text-stone-500">–</span>
          <span className={theyLead ? 'text-amber-400 font-bold' : ''}>{losses}</span>
          {(draws ?? 0) > 0 && (
            <>
              <span className="text-stone-500">({draws})</span>
            </>
          )}
        </div>
        <div className={`flex items-center gap-2 min-w-0 ${theyLead ? 'text-amber-400 font-semibold' : ''}`}>
          <span className="truncate max-w-[80px] sm:max-w-[100px]" title={opponentName}>{opponentName || 'היריב'}</span>
          <div
            className="w-8 h-8 rounded-full flex-shrink-0 border-2 border-stone-500"
            style={oppStyle}
            title={opponentName}
          />
        </div>
      </div>
    </div>
  );
}

export default function FlagCaptureCelebration({
  gameOverPayload,
  won,
  winType = 'flag',
  onComplete,
  rematchRequested,
  requestRematch,
  playerId,
  isPlayer2,
  disconnectWin,
  opponentConnected,
  myId,
  opponentId,
  myName,
  opponentName,
  myTeamColor,
  opponentTeamColor,
  authToken,
}) {
  const iRequested = rematchRequested?.[playerId];
  const otherRequested = Object.keys(rematchRequested ?? {}).some((id) => id !== playerId && rematchRequested[id]);
  const bothReady = iRequested && otherRequested;
  const [rivalry, setRivalry] = useState(null);

  useEffect(() => {
    if (!myId || !opponentId || !authToken || !gameOverPayload) return;
    setRivalry(null);
    let cancelled = false;
    const timer = setTimeout(() => {
      const qs = new URLSearchParams({ myId: String(myId), opponentId: String(opponentId) });
      fetch(`${API_BASE}/api/stats/rivalry?${qs}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && data) setRivalry(data);
        })
        .catch(() => {});
    }, RIVALRY_FETCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [myId, opponentId, authToken, gameOverPayload]);

  if (won) {
    const winContent = (
      <motion.div
        className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-lg overflow-hidden touch-manipulation"
        style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="relative z-10 text-center px-6 py-8 bg-stone-900/95 rounded-2xl border-2 border-stone-600 shadow-2xl max-w-md w-full mx-4"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <p className="text-2xl sm:text-3xl font-black text-green-400">
            🏆 {WIN_LABELS[winType]?.sub ?? WIN_LABELS.flag.sub}
          </p>
          <p className="text-lg text-amber-200/90 mt-1">
            {WIN_LABELS[winType]?.title ?? WIN_LABELS.flag.title}
          </p>
          {rivalry != null && (
            <RivalryScorecard
              myName={myName}
              opponentName={opponentName}
              myTeamColor={myTeamColor}
              opponentTeamColor={opponentTeamColor}
              wins={rivalry.wins}
              losses={rivalry.losses}
              draws={rivalry.draws}
            />
          )}
          {!disconnectWin && opponentConnected && (
            <button
              type="button"
              onClick={requestRematch}
              disabled={iRequested}
              className="mt-6 w-full min-h-[48px] px-4 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-amber-600 disabled:cursor-default text-white font-medium transition-colors touch-manipulation active:scale-[0.98]"
            >
              {bothReady ? 'פותח משחק חוזר...' : iRequested ? 'מחכה לאישור היריב...' : 'משחק חוזר'}
            </button>
          )}
        </motion.div>
      </motion.div>
    );
    return wrapForPlayer2(winContent, isPlayer2);
  }

  const loseContent = (
    <motion.div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-lg overflow-hidden touch-manipulation"
      style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.5)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="text-center px-6 py-8 bg-stone-900/95 rounded-2xl border-2 border-stone-600 shadow-2xl max-w-md w-full mx-4"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <p className="text-2xl sm:text-3xl font-black text-red-500">
          {LOSE_LABELS[winType]?.sub ?? LOSE_LABELS.flag.sub}
        </p>
        <p className="text-lg text-stone-400 mt-1">
          {LOSE_LABELS[winType]?.title ?? LOSE_LABELS.flag.title}
        </p>
        {rivalry != null && (
          <RivalryScorecard
            myName={myName}
            opponentName={opponentName}
            myTeamColor={myTeamColor}
            opponentTeamColor={opponentTeamColor}
            wins={rivalry.wins}
            losses={rivalry.losses}
            draws={rivalry.draws}
          />
        )}
        {!disconnectWin && opponentConnected && (
          <button
            type="button"
            onClick={requestRematch}
            disabled={iRequested}
            className="mt-6 w-full min-h-[48px] px-4 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-amber-600 disabled:cursor-default text-white font-medium transition-colors touch-manipulation active:scale-[0.98]"
          >
            {bothReady ? 'פותח משחק חוזר...' : iRequested ? 'מחכה לאישור היריב...' : 'משחק חוזר'}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
  return wrapForPlayer2(loseContent, isPlayer2);
}
