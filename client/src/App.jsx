import Board from './components/Board';
import Lobby from './components/Lobby';
import SetupBoard from './components/SetupBoard';
import { useGame } from './context/GameContext';

export default function App() {
  const { connected, setupPhase, setupTimer } = useGame();

  const totalSec = 30;
  const progress = setupTimer !== null ? (setupTimer / totalSec) * 100 : 100;

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-900 text-stone-900 dark:text-stone-100 flex flex-col items-center p-4">
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
      <header className="text-center mb-6 mt-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-800 dark:text-stone-100">
          RPS Stratego
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
          {connected ? 'Connected' : 'Connecting...'}
        </p>
      </header>

      <main className="flex flex-col items-center gap-8">
        <Lobby />
        {setupPhase ? <SetupBoard /> : <Board />}
      </main>
    </div>
  );
}
