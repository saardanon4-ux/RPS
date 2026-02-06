import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../context/GameContext';
import HowToPlayModal from './HowToPlayModal';

export default function WelcomeScreen() {
  const { connected, roomId, player, error, joinRoom, leaveRoom, authUser, setAuth } = useGame();
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

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) || null,
    [groups, selectedGroupId],
  );

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
    const displayName = authUser?.username || 'Guest';
    joinRoom(inputRoomId, displayName);
  };

  if (roomId && player) {
    return (
      <motion.div
        className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-white/80 text-sm font-medium">Room:</span>
          <code className="px-3 py-1 rounded-lg bg-white/10 text-amber-300 font-mono text-sm">{roomId}</code>
        </div>
        <motion.button
          type="button"
          onClick={leaveRoom}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 text-sm font-medium transition-colors border border-white/10"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Leave
        </motion.button>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative">
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
        >
          <button
            type="button"
            onClick={() => setShowHowTo(true)}
            className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-amber-400 text-slate-900 text-xs font-semibold shadow-lg hover:bg-amber-300 transition-colors"
          >
            איך משחקים?
          </button>
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
            STRATEGO BATTLE
          </motion.p>

          {authUser && (
            <div className="mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-400/40 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {authUser.group?.color && (
                  <span
                    className="inline-block w-3 h-3 rounded-full border border-white/60 shadow-sm"
                    style={{ backgroundColor: authUser.group.color }}
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
              <span className="text-[11px] text-emerald-200/80">
                מוכן לקרב 💥
              </span>
            </div>
          )}

          {/* Auth form */}
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
                    className="w-full px-4 py-3.5 rounded-xl bg-white/5 border-2 border-white/20 hover:border-white/30 text-left flex items-center justify-between gap-3 text-sm text-white/90"
                  >
                    <span className="flex items-center gap-2">
                      {selectedGroup ? (
                        <>
                          <span
                            className="inline-block w-3.5 h-3.5 rounded-full border border-white/60 shadow-sm"
                            style={{ backgroundColor: selectedGroup.color }}
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
                              style={{ backgroundColor: group.color }}
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

          {/* Room / Lobby section */}
          <form onSubmit={handleJoin} className="space-y-5">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
            >
              <label htmlFor="room" className="block text-sm font-semibold text-white/80 mb-2">
                Room ID
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
                placeholder="abc123 or leave empty for new"
                className={`w-full px-4 py-3.5 rounded-xl bg-white/5 border-2 text-white placeholder-white/40 outline-none transition-all duration-300 ${
                  focusedField === 'room'
                    ? 'border-amber-400/80 shadow-[0_0_20px_rgba(251,191,36,0.3)]'
                    : 'border-white/20 hover:border-white/30'
                }`}
              />
            </motion.div>

            {error && (
              <motion.p
                className="text-red-400 text-sm font-medium"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <motion.button
                type="submit"
                disabled={!connected || !authUser}
                className="w-full py-4 rounded-xl font-bold text-lg text-stone-900 bg-gradient-to-r from-amber-400 to-orange-500 disabled:from-stone-500 disabled:to-stone-600 disabled:cursor-not-allowed relative overflow-hidden"
                style={{
                  boxShadow: connected
                    ? '0 0 30px rgba(251,191,36,0.4), 0 4px 20px rgba(0,0,0,0.3)'
                    : 'none',
                }}
                whileHover={connected ? { scale: 1.02 } : {}}
                whileTap={connected ? { scale: 0.98 } : {}}
              >
                {!connected
                  ? 'Connecting...'
                  : !authUser
                    ? 'התחבר כדי להיכנס לחדר'
                    : 'Join Game'}
              </motion.button>
            </motion.div>
          </form>
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
