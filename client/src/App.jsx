import { useState, useEffect } from 'react';
import Board from './components/Board';
import WelcomeScreen from './components/WelcomeScreen';
import GameHUD from './components/GameHUD';
import SetupBoard from './components/SetupBoard';
import HowToPlayModal from './components/HowToPlayModal';
import MatchupScreen from './components/MatchupScreen';
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
  const [showHowTo, setShowHowTo] = useState(false);
  const [showMatchup, setShowMatchup] = useState(false);
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

  useEffect(() => {
    if (!setupPhase || players.length !== 2) {
      setShowMatchup(false);
      return;
    }
    // Show matchup screen briefly at the beginning of setup
    setShowMatchup(true);
    const id = setTimeout(() => {
      setShowMatchup(false);
    }, 3000);
    return () => clearTimeout(id);
  }, [setupPhase, players.length]);

  if (!inRoom) {
    return <WelcomeScreen />;
  }

  return (
    <div className="h-[100dvh] bg-gradient-to-b from-slate-900 via-indigo-950/50 to-slate-900 text-white flex flex-col overflow-hidden">
      {opponentLeft && (
        <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-center gap-4 px-4 py-3 bg-amber-900/90 border-b border-amber-600/50 backdrop-blur-sm">
          <span className="text-amber-200 font-medium">השחקן השני עזב את החדר.</span>
          <button
            type="button"
            onClick={leaveRoom}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors"
          >
            צא מהחדר
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
            <span>{setupTimer ?? 0} שניות</span>
            <span className={progress > 66 ? 'text-green-400' : progress > 33 ? 'text-yellow-400' : 'text-red-400'}>
              {progress > 66 ? 'שלב הכנה' : progress > 33 ? 'להזדרז!' : 'כמעט נגמר הזמן!'}
            </span>
          </div>
        </div>
      )}

      <header className="flex flex-col items-center gap-2 px-4 py-2 shrink-0">
        <div className="flex items-center justify-between w-full gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <h1
              className="text-xl font-bold tracking-tight text-white/90"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              אחסן, נייר ומספריים
            </h1>
            <button
              type="button"
              onClick={() => setShowHowTo(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/20 text-xs font-semibold text-white/90 shadow-sm"
            >
              <span className="text-amber-300 text-base">?</span>
              <span className="whitespace-nowrap">איך משחקים?</span>
            </button>
          </div>
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

      <div className="flex-1 flex flex-col relative min-h-0 overflow-hidden">
        <main className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center p-4">
          {setupPhase ? <SetupBoard /> : <Board />}
        </main>
      </div>

      <HowToPlayModal open={showHowTo} onClose={() => setShowHowTo(false)} />
      {players.length === 2 && (
        <MatchupScreen
          visible={showMatchup}
          player1={players.find((p) => p.side === 'bottom') || players[0]}
          player2={players.find((p) => p.side === 'top') || players[1]}
        />
      )}
    </div>
  );
}
