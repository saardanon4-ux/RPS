import { memo } from 'react';
import { motion } from 'framer-motion';

/** Map team kit to opponent's away kit when both have the same kit (clash). */
function getClashKit(color) {
  const c = String(color || '').toLowerCase();
  switch (c) {
    case 'red':
      return 'whiteandred';
    case 'whiteandred':
      return 'red';
    case 'yellow':
      return 'blackandyellow';
    case 'blackandyellow':
      return 'yellow';
    case 'blue':
      return 'lightblue';
    case 'lightblue':
      return 'blue';
    case 'green':
      return 'whiteandred';
    case 'blackandred':
      return 'red';
    default:
      return 'whiteandred';
  }
}

/** If value looks like hex, return a default kit name so path is valid. */
function toKitName(color) {
  if (!color) return 'red';
  const s = String(color).trim();
  if (s.startsWith('#') || /^[0-9a-fA-F]{6}$/.test(s.replace(/^#/, ''))) return 'red';
  return s;
}

function GamePieceInner({ piece, isMine, myTeamColor, opponentTeamColor, displayColor, isSelected }) {
  const myKit = toKitName(myTeamColor);
  const oppKit = toKitName(opponentTeamColor);

  const getKitName = () => {
    if (isMine) return myKit;
    if (myKit === oppKit) return getClashKit(myKit);
    return oppKit;
  };

  const kit = getKitName();
  const type = (isMine || piece?.revealed) ? (piece?.type || 'hidden') : 'hidden';
  const imagePath = `/assets/units/${kit}.${type}.png`;

  const isHidden = type === 'hidden';

  if (!piece) return null;

  const style = {
    boxShadow: displayColor ? `0 0 12px ${displayColor}aa` : undefined,
  };

  const img = (
    <img
      src={imagePath}
      alt={`${kit} ${type}`}
      className="w-full h-full object-contain drop-shadow-md transition-transform duration-300"
      style={style}
      onError={(e) => {
        console.error(`Missing image: ${imagePath}`);
        e.target.style.display = 'none';
      }}
    />
  );

  if (isHidden) {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <motion.div
          className="w-full h-full flex items-center justify-center"
          animate={{ scale: [1, 1.05, 1], rotate: [-2, 2, -2] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {img}
        </motion.div>
        {isMine && isSelected && (
          <div className="absolute inset-0 border-2 border-yellow-400 rounded pointer-events-none animate-pulse" />
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <motion.div
        className="w-full h-full flex items-center justify-center"
        initial={{ scale: 0.9, opacity: 0.8 }}
        animate={{ scale: [1, 1.04, 1], opacity: 1 }}
        transition={{ scale: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } }}
      >
        {img}
      </motion.div>
      {isMine && isSelected && (
        <div className="absolute inset-0 border-2 border-yellow-400 rounded pointer-events-none animate-pulse" />
      )}
    </div>
  );
}

const GamePiece = memo(GamePieceInner);

export default GamePiece;
export function isColorClash(myTeamColor, opponentTeamColor) {
  return toKitName(myTeamColor) === toKitName(opponentTeamColor);
}
