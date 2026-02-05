import Board from './components/Board';
import WelcomeScreen from './components/WelcomeScreen';
import PlayerBanner from './components/PlayerBanner';
import SetupBoard from './components/SetupBoard';
import { useGame } from './context/GameContext';

export default function App() {
  const { connected, setupPhase, setupTimer, roomId, player, players, gameState } = useGame();

  const totalSec = 40;
  const progress = setupTimer !== null ? (setupTimer / totalSec) * 100 : 100;
  const inRoom = roomId && player;
  const opponent = players.find((p) => p.id !== player?.id);
  const currentTurn = gameState?.currentTurn;

  if (!inRoom) {
    return <WelcomeScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950/50 to-slate-900 text-white flex flex-col">
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

      <header className="flex items-center justify-between px-4 py-3 gap-4">
        <h1 className="text-xl font-bold tracking-tight text-white/90 shrink-0" style={{ fontFamily: "'Orbitron', sans-serif" }}>
          RPS STRATEGO
        </h1>
        <div className="flex-1 flex justify-end min-w-0">
          <WelcomeScreen />
        </div>
      </header>

      <div className="flex-1 flex flex-col relative min-h-0">
        {players.length === 2 && (
          <>
            <div className="absolute top-2 left-0 right-0 z-10 flex justify-center px-4">
              <PlayerBanner
                nickname={opponent?.name}
                isOpponent
                isTheirTurn={!!currentTurn && currentTurn === opponent?.id}
                position="top"
              />
            </div>
            <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center px-4">
              <PlayerBanner
                nickname={player?.name}
                isOpponent={false}
                isTheirTurn={!!currentTurn && currentTurn === player?.id}
                position="bottom"
              />
            </div>
          </>
        )}

        <main className="flex-1 flex items-center justify-center p-4 pt-16 pb-16">
          {setupPhase ? <SetupBoard /> : <Board />}
        </main>
      </div>
    </div>
  );
}
