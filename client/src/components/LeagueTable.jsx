import { useEffect, useState } from 'react';
import { getTeamColorStyle } from '../utils/colors';

const apiBase = import.meta.env.VITE_SERVER_URL || '';

export default function LeagueTable() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${apiBase}/api/stats/groups`);
        if (!res.ok) throw new Error('שגיאה בטעינת טבלת הליגה');
        const data = await res.json();
        if (!cancelled) {
          setGroups(Array.isArray(data) ? data.slice(0, 10) : []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'שגיאה בטעינת טבלת הליגה');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="mt-6 rounded-2xl bg-white/5 border border-white/15 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white/90">טבלת ליגה</h2>
      </div>

      {loading && <p className="text-xs text-white/70">טוען טבלת ליגה...</p>}
      {error && !loading && <p className="text-xs text-red-400">{error}</p>}

      {!loading && !error && groups.length === 0 && (
        <p className="text-xs text-white/60">עדיין אין תוצאות. שחקו משחק ראשון כדי לפתוח את הטבלה.</p>
      )}

      {!loading && !error && groups.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right text-white/90">
            <thead>
              <tr className="text-[11px] text-white/60 border-b border-white/10">
                <th className="pb-2 font-semibold">דירוג</th>
                <th className="pb-2 font-semibold pr-2">קבוצה</th>
                <th className="pb-2 font-semibold">ניצחונות</th>
                <th className="pb-2 font-semibold">הפסדים</th>
                <th className="pb-2 font-semibold">אחוז ניצחונות</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g, idx) => (
                <tr
                  key={g.id}
                  className="border-b border-white/5 last:border-b-0 hover:bg-white/5 transition-colors"
                >
                  <td className="py-1.5 text-center text-white/80">{idx + 1}</td>
                  <td className="py-1.5 pr-2">
                    <div className="flex items-center justify-start gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full border border-white/60"
                        style={getTeamColorStyle(g.color)}
                      />
                      <span className="font-semibold truncate">{g.name}</span>
                    </div>
                  </td>
                  <td className="py-1.5 text-center">{g.wins}</td>
                  <td className="py-1.5 text-center">{g.losses}</td>
                  <td className="py-1.5 text-center">
                    {g.winPercentage != null ? `${g.winPercentage.toFixed(2)}%` : '0%'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

