import { useEffect, useState, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { getTeamColorStyle } from '../utils/colors';

const apiBase = import.meta.env.VITE_SERVER_URL || '';

function formatStreak(streak) {
  if (!streak?.type || !streak.count) return 'ללא רצף פעיל';
  const n = streak.count;
  if (streak.type === 'win') return `${n} ניצחונות רצופים`;
  if (streak.type === 'loss') return `${n} הפסדים רצופים`;
  if (streak.type === 'draw') return `${n} משחקי תיקו ברצף`;
  return 'ללא רצף פעיל';
}

export default function PlayerStatsPanel() {
  const { authUser, authToken } = useGame();
  const [summary, setSummary] = useState(null);
  const [headToHead, setHeadToHead] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const hasAuth = !!authUser && !!authToken;

  useEffect(() => {
    if (!hasAuth) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [meRes, h2hRes] = await Promise.all([
          fetch(`${apiBase}/api/stats/me`, {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
          fetch(`${apiBase}/api/stats/headtohead`, {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
        ]);

        if (!meRes.ok) {
          const body = await meRes.json().catch(() => ({}));
          throw new Error(body?.error || 'שגיאה בטעינת נתוני השחקן');
        }
        if (!h2hRes.ok) {
          const body = await h2hRes.json().catch(() => ({}));
          throw new Error(body?.error || 'שגיאה בטעינת נתוני ראש בראש');
        }

        const meData = await meRes.json();
        const h2hData = await h2hRes.json();
        if (!cancelled) {
          setSummary(meData);
          setHeadToHead(Array.isArray(h2hData) ? h2hData : []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'שגיאה בטעינת הנתונים');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    const interval = setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [hasAuth, authToken]);

  const stats = summary?.stats;
  const user = summary?.user || authUser;

  const winRateLabel = useMemo(() => {
    if (!stats) return '0%';
    return `${stats.winRate?.toFixed?.(2) ?? stats.winRate ?? 0}%`;
  }, [stats]);

  if (!hasAuth) return null;

  return (
    <div className="mt-4 rounded-2xl bg-white/5 border border-white/15 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white/90">אזור אישי</span>
          <span className="text-[11px] text-white/60">
            סטטיסטיקות עונתיות ורשימת ראש בראש מול יריבים
          </span>
        </div>
        {user?.group?.name && (
          <div className="flex items-center gap-2 text-xs text-white/80">
            <span
              className="inline-block w-3 h-3 rounded-full border border-white/60"
              style={getTeamColorStyle(user.group.color)}
            />
            <span>{user.group.name}</span>
          </div>
        )}
      </div>

      {loading && <p className="text-xs text-white/70">טוען נתונים אישיים...</p>}
      {error && !loading && <p className="text-xs text-red-400">{error}</p>}

      {!loading && !error && stats && (
        <>
          <div className="grid grid-cols-2 gap-3 text-xs text-white/90">
            <div>
              <p className="text-white/60 text-[11px]">שם שחקן</p>
              <p className="font-semibold">{user?.username}</p>
            </div>
            <div>
              <p className="text-white/60 text-[11px]">סך משחקים</p>
              <p className="font-semibold">{stats.totalGames}</p>
            </div>
            <div>
              <p className="text-white/60 text-[11px]">ניצחונות</p>
              <p className="font-semibold text-emerald-300">{stats.wins}</p>
            </div>
            <div>
              <p className="text-white/60 text-[11px]">הפסדים</p>
              <p className="font-semibold text-red-300">{stats.losses}</p>
            </div>
            <div>
              <p className="text-white/60 text-[11px]">אחוז ניצחונות</p>
              <p className="font-semibold">{winRateLabel}</p>
            </div>
            <div className="col-span-2">
              <p className="text-white/60 text-[11px]">רצף נוכחי</p>
              <p className="font-semibold">{formatStreak(stats.currentStreak)}</p>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-xs font-semibold text-white/80 mb-2">מאזן ראש בראש</h3>
            {headToHead.length === 0 && (
              <p className="text-[11px] text-white/60">
                עדיין אין משחקים ראש בראש. שחק כמה משחקים כדי לפתוח את הרשימה.
              </p>
            )}
            {headToHead.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-white/5">
                <table className="w-full text-[11px] text-right text-white/90">
                  <thead className="sticky top-0 bg-slate-900/80">
                    <tr className="text-white/60">
                      <th className="py-2 pr-2 font-semibold">שחקן</th>
                      <th className="py-2 font-semibold">קבוצה</th>
                      <th className="py-2 font-semibold">משחקים</th>
                      <th className="py-2 font-semibold">מאזן (נ/ה)</th>
                      <th className="py-2 font-semibold">אחוז ניצחונות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headToHead.map((row) => (
                      <tr
                        key={row.opponentId}
                        className="border-t border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-1.5 pr-2 font-semibold truncate">{row.opponentName}</td>
                        <td className="py-1.5">
                          <div className="flex items-center justify-start gap-1.5">
                            {row.opponentGroupName && (
                              <span
                                className="inline-block w-2 h-2 rounded-full border border-white/60"
                                style={{ backgroundColor: row.opponentGroupColor || '#64748b' }}
                              />
                            )}
                            <span className="truncate">
                              {row.opponentGroupName ?? 'קבוצה לא ידועה'}
                            </span>
                          </div>
                        </td>
                        <td className="py-1.5 text-center">{row.games}</td>
                        <td className="py-1.5 text-center">
                          {row.wins}/{row.losses}
                        </td>
                        <td className="py-1.5 text-center">
                          {row.winPercentage != null ? `${row.winPercentage.toFixed(2)}%` : '0%'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

