import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../context/GameContext';

export default function WelcomeScreen() {
  const { connected, roomId, player, players, error, joinRoom, leaveRoom } = useGame();
  const [inputRoomId, setInputRoomId] = useState('');
  const [inputName, setInputName] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  const handleJoin = (e) => {
    e.preventDefault();
    joinRoom(inputRoomId, inputName);
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
    <div className="min-h-screen w-full flex items-center justify-center p-4 overflow-hidden relative">
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div
          className="rounded-3xl p-8 sm:p-10 backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl shadow-purple-900/20"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)' }}
        >
          <motion.h1
            className="text-3xl sm:text-4xl font-black text-center mb-2 tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-orange-400"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            STRATEGO BATTLE
          </motion.h1>
          <motion.p
            className="text-center text-white/60 text-sm mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            אחסן, נייר ומספריים
          </motion.p>

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

            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label htmlFor="name" className="block text-sm font-semibold text-white/80 mb-2">
                Player Name
              </label>
              <input
                id="name"
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
                placeholder="Your nickname"
                className={`w-full px-4 py-3.5 rounded-xl bg-white/5 border-2 text-white placeholder-white/40 outline-none transition-all duration-300 ${
                  focusedField === 'name'
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
                disabled={!connected}
                className="w-full py-4 rounded-xl font-bold text-lg text-stone-900 bg-gradient-to-r from-amber-400 to-orange-500 disabled:from-stone-500 disabled:to-stone-600 disabled:cursor-not-allowed relative overflow-hidden"
                style={{
                  boxShadow: connected
                    ? '0 0 30px rgba(251,191,36,0.4), 0 4px 20px rgba(0,0,0,0.3)'
                    : 'none',
                }}
                whileHover={connected ? { scale: 1.02 } : {}}
                whileTap={connected ? { scale: 0.98 } : {}}
              >
                {connected ? 'Join Game' : 'Connecting...'}
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
    </div>
  );
}
