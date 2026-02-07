import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../context/GameContext';
import { getTeamColorStyle } from '../utils/colors';
import HowToPlayModal from './HowToPlayModal';
import PlayerStatsPanel from './PlayerStatsPanel';

export default function WelcomeScreen() {
  const { connected, roomId, player, error, joinRoom, leaveRoom, authUser, setAuth, clearAuth, roomListVersion } =
    useGame();
  const [inputRoomId, setInputRoomId] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  const [showHowTo, setShowHowTo] = useState(false);
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);

  // Tab navigation for authenticated users
  const [activeTab, setActiveTab] = useState('lobby');
  const [leaderboardMode, setLeaderboardMode] = useState('groups'); // 'players' | 'groups'

  // Lobby: active rooms + filter
  const [activeRooms, setActiveRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomFilter, setRoomFilter] = useState('');

  // Leaderboard: players or groups data
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState(null);

  const apiBase = import.meta.env.VITE_SERVER_URL || '';

  useEffect(() => {
    let cancelled = false;
    const loadGroups = async () => {
      try {
        setGroupsLoading(true);
        const res = await fetch(`${apiBase}/auth/groups`);
        if (!res.ok) throw new Error('Failed to load groups');
        const data = await res.json();
        if (!cancelled) {
          setGroups(data || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading groups', err);
        }
      } finally {
        if (!cancelled) setGroupsLoading(false);
      }
    };
    loadGroups();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  // Fetch active rooms when Lobby tab is active
  useEffect(() => {
    if (!authUser || activeTab !== 'lobby') return;
    let cancelled = false;
    const load = async () => {
      try {
        setRoomsLoading(true);
        const res = await fetch(`${apiBase}/api/rooms/active`);
        if (!res.ok) throw new Error('Failed to load rooms');
        const data = await res.json();
        if (!cancelled) setActiveRooms(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setActiveRooms([]);
      } finally {
        if (!cancelled) setRoomsLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authUser, activeTab, apiBase, roomListVersion]);

  // Fetch leaderboard when Leaderboard tab is active
  useEffect(() => {
    if (!authUser || activeTab !== 'leaderboard') return;
    let cancelled = false;
    const load = async () => {
      try {
        setLeaderboardLoading(true);
        setLeaderboardError(null);
        const endpoint = leaderboardMode === 'players' ? '/api/stats/players' : '/api/stats/groups';
        const res = await fetch(`${apiBase}${endpoint}`);
        if (!res.ok) throw new Error('שגיאה בטעינת הטבלה');
        const data = await res.json();
        if (!cancelled) setLeaderboardData(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setLeaderboardError(err.message || 'שגיאה בטעינת הטבלה');
          setLeaderboardData([]);
        }
      } finally {
        if (!cancelled) setLeaderboardLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authUser, activeTab, leaderboardMode, apiBase]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) || null,
    [groups, selectedGroupId],
  );

  const filteredRooms = useMemo(() => {
    const q = (roomFilter || '').trim().toLowerCase();
    if (!q) return activeRooms;
    return activeRooms.filter((r) => (r.teamName || '').toLowerCase().includes(q));
  }, [activeRooms, roomFilter]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);
    if (!username || !password) {
      setAuthError('שם משתמש וסיסמה הם שדות חובה.');
      return;
    }
    if (mode === 'register' && !selectedGroupId) {
      setAuthError('בחר קבוצה לפני הרשמה.');
      return;
    }
    setAuthLoading(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload =
        mode === 'login'
          ? { username, password }
          : { username, password, groupName: selectedGroup?.name };

      const res = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'אירעה שגיאה בתהליך ההתחברות/הרשמה.');
      }

      if (!data?.user || !data?.token) {
        throw new Error('תגובת שרת לא תקינה.');
      }

      setAuth(data.user, data.token);
    } catch (err) {
      setAuthError(err.message || 'אירעה שגיאה בתהליך ההתחברות/הרשמה.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    joinRoom(inputRoomId);
  };

  if (roomId && player) {
    return (
      <motion.div
        className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-white/80 text-sm font-medium">חדר:</span>
          <code className="px-3 py-1 rounded-lg bg-white/10 text-amber-300 font-mono text-sm">{roomId}</code>
        </div>
        <motion.button
          type="button"
          onClick={leaveRoom}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 text-sm font-medium transition-colors border border-white/10"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          צא מהחדר
        </motion.button>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative" dir="rtl">
      {/* Animated gradient background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 25%, #312e81 50%, #4c1d95 75%, #1e1b4b 100%)',
          backgroundSize: '400% 400%',
          animation: 'gradientShift 15s ease infinite',
        }}
      />
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div
          className="rounded-3xl p-8 sm:p-10 backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl shadow-purple-900/20 relative"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)' }}
          dir="rtl"
        >
          <div className="absolute -top-3 right-0 flex items-center gap-2">
            {authUser && (
              <button
                type="button"
                onClick={clearAuth}
                className="px-3 py-1.5 rounded-full bg-white/15 text-white/90 text-xs font-medium hover:bg-white/25 transition-colors border border-white/20"
              >
                התנתק
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowHowTo(true)}
              className="px-3 py-1.5 rounded-full bg-amber-400 text-slate-900 text-xs font-semibold shadow-lg hover:bg-amber-300 transition-colors"
            >
              איך משחקים?
            </button>
          </div>
          <motion.h1
            className="text-3xl sm:text-4xl font-black text-center mb-2 tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-orange-400"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            אחסן, נייר ומספריים
          </motion.h1>
          <motion.p
            className="text-center text-white/60 text-sm mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            קרב סטרטגו
          </motion.p>

          {authUser && (
            <div className="mb-5 rounded-2xl bg-emerald-500/10 border border-emerald-400/40 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {authUser.group?.color && (
                  <span
                    className="inline-block w-3 h-3 rounded-full border border-white/60 shadow-sm"
                    style={getTeamColorStyle(authUser.group.color)}
                  />
                )}
                <div className="flex flex-col">
                  <span className="text-xs text-emerald-300 font-semibold">
                    מחובר כ־ {authUser.username}
                  </span>
                  {authUser.group?.name && (
                    <span className="text-[11px] text-emerald-100/80">
                      קבוצה: {authUser.group.name}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[11px] text-emerald-200/80">
                  מוכן לקרב 💥
                </span>
                <button
                  type="button"
                  className="text-[11px] text-white/60 hover:text-white underline-offset-2 hover:underline"
                  onClick={clearAuth}
                >
                  התנתק / החלף משתמש
                </button>
              </div>
            </div>
          )}

          {!authUser && (
            <form onSubmit={handleAuthSubmit} className="space-y-4 mb-6">
              <div className="flex items-center justify-center gap-2 rounded-full bg-white/5 p-1 border border-white/10">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    mode === 'login'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-white/70 hover:bg-white/10'
                  }`}
                >
                  התחברות
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    mode === 'register'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-white/70 hover:bg-white/10'
                  }`}
                >
                  הרשמה
                </button>
              </div>

              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
              >
                <label htmlFor="username" className="block text-sm font-semibold text-white/80 mb-2">
                  שם משתמש
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="הקלד שם משתמש"
                  className={`w-full px-4 py-3.5 rounded-xl bg-white/5 border-2 text-white placeholder-white/40 outline-none transition-all duration-300 ${
                    focusedField === 'username'
                      ? 'border-amber-400/80 shadow-[0_0_20px_rgba(251,191,36,0.3)]'
                      : 'border-white/20 hover:border-white/30'
                  }`}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <label htmlFor="password" className="block text-sm font-semibold text-white/80 mb-2">
                  סיסמה
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="בחר סיסמה סודית"
                  className={`w-full px-4 py-3.5 rounded-xl bg-white/5 border-2 text-white placeholder-white/40 outline-none transition-all duration-300 ${
                    focusedField === 'password'
                      ? 'border-amber-400/80 shadow-[0_0_20px_rgba(251,191,36,0.3)]'
                      : 'border-white/20 hover:border-white/30'
                  }`}
                />
              </motion.div>

              {mode === 'register' && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <label className="block text-sm font-semibold text-white/80 mb-2">
                    בחירת קבוצה
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setGroupDropdownOpen((open) => !open)}
                      className="w-full px-4 py-3.5 rounded-xl bg-white/5 border-2 border-white/20 hover:border-white/30 text-right flex items-center justify-between gap-3 text-sm text-white/90"
                    >
                      <span className="flex items-center gap-2">
                        {selectedGroup ? (
                          <>
                            <span
                              className="inline-block w-3.5 h-3.5 rounded-full border border-white/60 shadow-sm"
                              style={getTeamColorStyle(selectedGroup.color)}
                            />
                            <span>{selectedGroup.name}</span>
                          </>
                        ) : (
                          <span className="text-white/50">
                            {groupsLoading ? 'טוען קבוצות...' : 'בחר קבוצה אהובה מהליגה'}
                          </span>
                        )}
                      </span>
                      <span className="text-white/60 text-xs">
                        {groupDropdownOpen ? '▲' : '▼'}
                      </span>
                    </button>

                    {groupDropdownOpen && !groupsLoading && (
                      <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl bg-slate-900/95 border border-white/15 shadow-xl">
                        {groups.map((group) => (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => {
                              setSelectedGroupId(group.id);
                              setGroupDropdownOpen(false);
                            }}
                            className="w-full px-3 py-2.5 flex items-center justify-between gap-3 text-xs text-white/90 hover:bg-white/10"
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-block w-3 h-3 rounded-full border border-white/60 shadow-sm"
                                style={getTeamColorStyle(group.color)}
                              />
                              <span>{group.name}</span>
                            </span>
                          </button>
                        ))}
                        {groups.length === 0 && (
                          <div className="px-3 py-2 text-xs text-white/60">
                            לא נמצאו קבוצות. ודא שהשרת רץ.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {authError && (
                <motion.p
                  className="text-red-400 text-sm font-medium"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {authError}
                </motion.p>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <motion.button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-slate-900 bg-gradient-to-r from-amber-300 to-orange-400 disabled:from-stone-500 disabled:to-stone-600 disabled:cursor-not-allowed relative overflow-hidden"
                  whileHover={!authLoading ? { scale: 1.02 } : {}}
                  whileTap={!authLoading ? { scale: 0.98 } : {}}
                >
                  {authLoading
                    ? 'מעבד...'
                    : mode === 'login'
                      ? 'התחבר'
                      : 'הירשם והצטרף לליגה'}
                </motion.button>
              </motion.div>
            </form>
          )}

          {authUser ? (
            <>
              {/* Sticky tab bar */}
              <nav
                className="sticky top-0 z-10 -mx-8 -mt-2 px-4 py-3 flex items-center justify-center gap-1 rounded-b-2xl bg-white/5 border-b border-white/10 backdrop-blur-xl mb-4"
                aria-label="ניווט"
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('lobby')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'lobby'
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                      : 'text-white/70 hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <span aria-hidden>📋</span>
                  <span>לובי</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('leaderboard')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'leaderboard'
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                      : 'text-white/70 hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <span aria-hidden>🏆</span>
                  <span>טבלאות</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('personal')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'personal'
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                      : 'text-white/70 hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <span aria-hidden>👤</span>
                  <span>אזור אישי</span>
                </button>
              </nav>

              {/* Tab content */}
              {activeTab === 'lobby' && (
                <div className="space-y-4">
                  <form onSubmit={handleJoin} className="space-y-3">
                    <label htmlFor="room" className="block text-sm font-semibold text-white/80">
                      מזהה חדר
                    </label>
                    <input
                      id="room"
                      type="text"
                      inputMode="text"
                      autoComplete="off"
                      value={inputRoomId}
                      onChange={(e) => setInputRoomId(e.target.value)}
                      onFocus={() => setFocusedField('room')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="abc123 או השאר ריק ליצירת חדר חדש"
                      className={`w-full px-4 py-3 rounded-xl bg-white/5 border-2 text-white placeholder-white/40 outline-none transition-all ${
                        focusedField === 'room'
                          ? 'border-amber-400/80 shadow-[0_0_20px_rgba(251,191,36,0.3)]'
                          : 'border-white/20 hover:border-white/30'
                      }`}
                    />
                    <input
                      type="text"
                      value={roomFilter}
                      onChange={(e) => setRoomFilter(e.target.value)}
                      placeholder="חפש לפי קבוצה..."
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/20 text-white placeholder-white/40 outline-none text-sm"
                    />
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <motion.button
                      type="submit"
                      disabled={!connected}
                      className="w-full py-3 rounded-xl font-bold text-stone-900 bg-gradient-to-r from-amber-400 to-orange-500 disabled:from-stone-500 disabled:to-stone-600 disabled:cursor-not-allowed"
                      whileHover={connected ? { scale: 1.02 } : {}}
                      whileTap={connected ? { scale: 0.98 } : {}}
                    >
                      {!connected ? 'מתחבר לשרת...' : 'היכנס למגרש'}
                    </motion.button>
                  </form>

                  <div className="rounded-2xl bg-white/5 border border-white/15 p-4">
                    <h2 className="text-sm font-semibold text-white/90 mb-3">חדרים פעילים</h2>
                    {roomsLoading && <p className="text-xs text-white/70">טוען חדרים...</p>}
                    {!roomsLoading && filteredRooms.length === 0 && (
                      <div className="flex flex-col items-center gap-4 py-6">
                        <p className="text-sm text-white/60">אין חדרים פתוחים כרגע.</p>
                        <motion.button
                          type="button"
                          onClick={() => {
                            const id = crypto.randomUUID().slice(0, 8);
                            setInputRoomId(id);
                            joinRoom(id);
                          }}
                          disabled={!connected}
                          className="px-6 py-3 rounded-xl font-bold text-stone-900 bg-gradient-to-r from-amber-400 to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          whileHover={connected ? { scale: 1.05 } : {}}
                          whileTap={connected ? { scale: 0.98 } : {}}
                        >
                          צור חדר חדש
                        </motion.button>
                      </div>
                    )}
                    {!roomsLoading && filteredRooms.length > 0 && (
                      <ul className="space-y-2 max-h-56 overflow-y-auto">
                        {filteredRooms.map((room) => (
                          <li
                            key={room.roomId}
                            className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="shrink-0 w-3 h-3 rounded-full border border-white/50"
                                style={getTeamColorStyle(room.teamColor)}
                              />
                              <span className="text-sm font-medium text-white/90 truncate">
                                {room.teamName || 'ללא שם'}
                              </span>
                              <span className="text-[11px] text-white/50">
                                {room.playersCount}/2
                              </span>
                            </div>
                            <motion.button
                              type="button"
                              onClick={() => joinRoom(room.roomId)}
                              disabled={!connected}
                              className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-400/20 text-amber-300 text-xs font-semibold hover:bg-amber-400/30 disabled:opacity-50"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              הצטרף
                            </motion.button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'leaderboard' && (
                <div className="rounded-2xl bg-white/5 border border-white/15 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-white/90">טבלת ליגה</h2>
                    <div className="flex rounded-full bg-white/5 p-0.5 border border-white/10">
                      <button
                        type="button"
                        onClick={() => setLeaderboardMode('players')}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          leaderboardMode === 'players'
                            ? 'bg-amber-400/30 text-amber-300'
                            : 'text-white/70 hover:bg-white/10'
                        }`}
                      >
                        שחקנים
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeaderboardMode('groups')}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          leaderboardMode === 'groups'
                            ? 'bg-amber-400/30 text-amber-300'
                            : 'text-white/70 hover:bg-white/10'
                        }`}
                      >
                        קבוצות
                      </button>
                    </div>
                  </div>
                  {leaderboardLoading && <p className="text-xs text-white/70">טוען...</p>}
                  {leaderboardError && !leaderboardLoading && (
                    <p className="text-xs text-red-400">{leaderboardError}</p>
                  )}
                  {!leaderboardLoading && !leaderboardError && leaderboardData.length === 0 && (
                    <p className="text-xs text-white/60">עדיין אין תוצאות. שחקו משחק ראשון.</p>
                  )}
                  {!leaderboardLoading && !leaderboardError && leaderboardData.length > 0 && (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-right text-white/90">
                          <thead>
                            <tr className="text-[11px] text-white/60 border-b border-white/10">
                              <th className="pb-2 font-semibold">דירוג</th>
                              <th className="pb-2 font-semibold pr-2">
                                {leaderboardMode === 'players' ? 'שחקן' : 'קבוצה'}
                              </th>
                              <th className="pb-2 font-semibold">ניצחונות</th>
                              <th className="pb-2 font-semibold">הפסדים</th>
                              <th className="pb-2 font-semibold">אחוז ניצחונות</th>
                            </tr>
                          </thead>
                          <tbody>
                            {leaderboardData.reduce((acc, row) => {
                              const gamesPlayed = row.gamesPlayed ?? row.games ?? 0;
                              const isRanked = gamesPlayed >= 8;
                              const rank = isRanked ? acc.rank++ : null;
                              acc.rows.push(
                                <tr
                                  key={row.id}
                                  className={`border-b border-white/5 last:border-b-0 hover:bg-white/5 ${
                                    !isRanked ? 'opacity-80' : ''
                                  }`}
                                  title={!isRanked ? 'לא מדורג - נדרשים מינימום 8 משחקים' : undefined}
                                >
                                  <td className="py-1.5 text-center text-white/80">
                                    {isRanked ? rank : <span className="text-white/50">–</span>}
                                  </td>
                                  <td className="py-1.5 pr-2">
                                    <div className="flex items-center justify-start gap-2">
                                      {(row.groupColor || row.color) && (
                                        <span
                                          className="inline-block w-2.5 h-2.5 rounded-full border border-white/60"
                                          style={getTeamColorStyle(row.groupColor || row.color)}
                                        />
                                      )}
                                      <span className="font-semibold truncate">
                                        {row.username || row.name}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-1.5 text-center">{row.wins}</td>
                                  <td className="py-1.5 text-center">{row.losses}</td>
                                  <td className="py-1.5 text-center">
                                    {row.winPercentage != null
                                      ? `${row.winPercentage.toFixed(2)}%`
                                      : '0%'}
                                  </td>
                                </tr>
                              );
                              return acc;
                            }, { rank: 1, rows: [] }).rows}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-3 text-xs text-white/50 text-center">
                        * הדירוג נקבע לפי אחוזי הצלחה. נדרשים מינימום 8 משחקים כדי להיכנס לדירוג.
                      </p>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'personal' && <PlayerStatsPanel />}
            </>
          ) : (
            <p className="mt-4 text-xs text-white/70">
              התחבר כדי לפתוח חדרים, לראות משחקים פעילים ולהצטרף לקרב.
            </p>
          )}
        </div>
      </motion.div>

      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>

      <HowToPlayModal open={showHowTo} onClose={() => setShowHowTo(false)} />
    </div>
  );
}
