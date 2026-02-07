import { useEffect, useState } from 'react';
import { getTeamColorStyle } from '../utils/colors';

const apiBase = import.meta.env.VITE_SERVER_URL || '';

export default function Leaderboard() {
  const [tab, setTab] = useState('players'); // 'players' | 'groups'
  const [data, setData] = useState({ players: [], groups: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${apiBase}/api/leaderboard`);
        if (!res.ok) throw new Error('שגיאה בטעינת הטבלה');
        const json = await res.json();
        if (!cancelled) {
          setData({
            players: json.players || [],
            groups: json.groups || [],
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'שגיאה בטעינת הטבלה');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-6 rounded-2xl bg-white/5 border border-white/15 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white/90">טבלת מובילים</h2>
        <div className="flex items-center gap-1 rounded-full bg-white/10 p-1 text-xs">
          <button
            type="button"
            onClick={() => setTab('players')}
            className={`px-3 py-1 rounded-full font-semibold ${
              tab === 'players' ? 'bg-white text-slate-900' : 'text-white/70'
            }`}
          >
            מובילים (שחקנים)
          </button>
          <button
            type="button"
            onClick={() => setTab('groups')}
            className={`px-3 py-1 rounded-full font-semibold ${
              tab === 'groups' ? 'bg-white text-slate-900' : 'text-white/70'
            }`}
          >
            מובילים (קבוצות)
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-xs text-white/70">טוען נתונים...</p>
      )}
      {error && !loading && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {!loading && !error && tab === 'players' && (
        <div className="space-y-1 mt-2 text-xs">
          {data.players.length === 0 && (
            <p className="text-white/60">עדיין אין נתונים. שחקו כמה משחקים!</p>
          )}
          {data.players.map((p, idx) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/5 border border-white/10"
            >
              <div className="flex items-center gap-2">
                <span className="text-white/60 w-5 text-center">{idx + 1}.</span>
                <span className="text-white/90 font-semibold">{p.username}</span>
                {p.group && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-white/70">
                    <span
                      className="inline-block w-2 h-2 rounded-full border border-white/60"
                      style={getTeamColorStyle(p.group.color)}
                    />
                    <span>{p.group.name}</span>
                  </span>
                )}
              </div>
              <div className="text-[11px] text-white/80">
                {p.wins} נצחונות / {p.losses} הפסדים / {p.draws} תיקו
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && tab === 'groups' && (
        <div className="space-y-1 mt-2 text-xs">
          {data.groups.length === 0 && (
            <p className="text-white/60">עדיין אין נתונים. שחקו כמה משחקים!</p>
          )}
          {data.groups.map((g, idx) => (
            <div
              key={g.id}
              className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/5 border border-white/10"
            >
              <div className="flex items-center gap-2">
                <span className="text-white/60 w-5 text-center">{idx + 1}.</span>
                <span className="text-white/90 font-semibold">{g.name}</span>
                <span
                  className="inline-block w-3 h-3 rounded-full border border-white/60"
                  style={getTeamColorStyle(g.color)}
                />
              </div>
              <div className="text-[11px] text-white/80">
                {g.totalWins} נצחונות / {g.totalLosses} הפסדים / {g.totalDraws} תיקו
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

