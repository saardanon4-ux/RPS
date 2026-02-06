import { useState, useEffect } from 'react';
import Board from './components/Board';
import WelcomeScreen from './components/WelcomeScreen';
import GameHUD from './components/GameHUD';
import SetupBoard from './components/SetupBoard';
import { useGame } from './context/GameContext';

const EMOJI_OPTIONS = ['🤫', '✂️', '🧠', '💣', '😂', '😈'];

function EmojiBar({ onSend, disabled }) {
  if (disabled) return null;
  return (
    <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 w-full max-w-xs">
      {EMOJI_OPTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSend(emoji)}
          className="text-xl hover:scale-110 active:scale-95 transition-transform"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const {
    setupPhase,
    setupTimer,
    roomId,
    player,
    players,
    gameState,
    gameOver,
    leaveRoom,
    emojiReactions,
    sendEmoji,
  } = useGame();

  const totalSec = 40;
  const progress = setupTimer !== null ? (setupTimer / totalSec) * 100 : 100;
  const inRoom = roomId && player;
  const currentTurn = gameState?.currentTurn;
  const myTurn = currentTurn === player?.id;
  const opponentLeft = inRoom && (setupPhase || gameState) && players.length === 1;

  const [turnRemaining, setTurnRemaining] = useState(30);
  const turnStartTime = gameState?.turnStartTime;
  useEffect(() => {
    if (!turnStartTime) return;
    const tick = () => {
      const elapsed = (Date.now() - turnStartTime) / 1000;
      setTurnRemaining(Math.max(0, 30 - elapsed));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [turnStartTime, gameState]);

  if (!inRoom) {
    return <WelcomeScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950/50 to-slate-900 text-white flex flex-col">
      {opponentLeft && (
        <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-center gap-4 px-4 py-3 bg-amber-900/90 border-b border-amber-600/50 backdrop-blur-sm">
          <span className="text-amber-200 font-medium">The other player left the room.</span>
          <button
            type="button"
            onClick={leaveRoom}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors"
          >
            Leave room
          </button>
        </div>
      )}
      {setupPhase && (
        <div className="fixed top-0 left-0 right-0 z-30">
          <div className="h-2 bg-stone-800/80 shadow-inner">
            <div
              className="h-full transition-all duration-1000 ease-linear rounded-r-full shadow-lg"
              style={{
                width: `${progress}%`,
                background:
                  progress > 66
                    ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                    : progress > 33
                      ? 'linear-gradient(90deg, #eab308, #facc15)'
                      : 'linear-gradient(90deg, #ef4444, #f87171)',
                boxShadow: '0 0 12px currentColor',
              }}
            />
          </div>
          <div className="flex justify-between px-2 py-1 text-xs font-bold text-stone-400">
            <span>{setupTimer ?? 0}s</span>
            <span className={progress > 66 ? 'text-green-400' : progress > 33 ? 'text-yellow-400' : 'text-red-400'}>
              {progress > 66 ? 'Setup' : progress > 33 ? 'Hurry!' : 'Almost out!'}
            </span>
          </div>
        </div>
      )}

      <header className="flex flex-col items-center gap-3 px-4 py-3">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-xl font-bold tracking-tight text-white/90 shrink-0" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            RPS STRATEGO
          </h1>
          <div className="flex-1 flex justify-end min-w-0">
            <WelcomeScreen />
          </div>
        </div>
        {players.length === 2 && !setupPhase && (
          <GameHUD
            players={players}
            currentTurn={currentTurn}
            turnRemaining={gameOver ? null : turnRemaining}
            gameOver={!!gameOver}
            localPlayerId={player?.id}
            emojiReactions={emojiReactions}
          />
        )}
        {players.length === 2 && !setupPhase && gameState && (
          <EmojiBar onSend={sendEmoji} disabled={!player} />
        )}
      </header>

      <div className="flex-1 flex flex-col relative min-h-0">
        <main className="flex-1 flex items-center justify-center p-4">
          {setupPhase ? <SetupBoard /> : <Board />}
        </main>
      </div>
    </div>
  );
}
