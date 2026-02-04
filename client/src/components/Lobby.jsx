import { useState } from 'react';
import { useGame } from '../context/GameContext';

export default function Lobby() {
  const { connected, roomId, player, players, error, joinRoom, leaveRoom } = useGame();
  const [inputRoomId, setInputRoomId] = useState('');
  const [inputName, setInputName] = useState('');

  const handleJoin = (e) => {
    e.preventDefault();
    joinRoom(inputRoomId, inputName);
  };

  if (roomId && player) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Room: <code className="px-2 py-1 bg-stone-200 dark:bg-stone-700 rounded">{roomId}</code>
          </p>
          <button
            type="button"
            onClick={leaveRoom}
            className="text-sm px-3 py-1.5 rounded-lg bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 transition-colors"
          >
            Leave
          </button>
        </div>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          You: <strong>{player.name}</strong> ({player.side})
        </p>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Players in room: {players.length}/2
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleJoin} className="space-y-4 max-w-xs">
      <div>
        <label htmlFor="room" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
          Room ID
        </label>
        <input
          id="room"
          type="text"
          value={inputRoomId}
          onChange={(e) => setInputRoomId(e.target.value)}
          placeholder="e.g. abc123 or leave empty for new"
          className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
        />
      </div>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
          Player Name (optional)
        </label>
        <input
          id="name"
          type="text"
          value={inputName}
          onChange={(e) => setInputName(e.target.value)}
          placeholder="Your name"
          className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <button
        type="submit"
        disabled={!connected}
        className="w-full px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-stone-400 disabled:cursor-not-allowed text-white font-medium transition-colors"
      >
        {connected ? 'Join Room' : 'Connecting...'}
      </button>
    </form>
  );
}
