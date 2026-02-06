import { memo } from 'react';
import { motion } from 'framer-motion';

/**
 * Get hue (0-360) from hex color.
 */
function hueFromHex(hex) {
  const h = hex.replace(/^#/, '');
  if (h.length !== 6) return 0;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hue = 0;
  if (max !== min) {
    const d = max - min;
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) hue = ((b - r) / d + 2) / 6;
    else hue = ((r - g) / d + 4) / 6;
  }
  return Math.round(hue * 360);
}

/**
 * Map team color (name or hex) to CSS filter. Base asset is RED.
 */
function getColorFilter(colorName) {
  if (!colorName) return 'none';
  const c = String(colorName).toLowerCase();

  if (c.includes('yellow') || c.includes('gold')) return 'hue-rotate(60deg) brightness(150%)';
  if (c.includes('green')) return 'hue-rotate(100deg)';
  if (c.includes('blue') || c.includes('cyan')) return 'hue-rotate(240deg)';
  if (c.includes('purple')) return 'hue-rotate(280deg)';
  if (c.includes('red')) return 'none';

  const hex = c.replace(/^#/, '');
  if (hex.length === 6 && /^[0-9a-f]+$/.test(hex)) {
    const hue = hueFromHex(hex);
    if (hue >= 40 && hue <= 85) return 'hue-rotate(60deg) brightness(150%)';
    if (hue >= 85 && hue <= 170) return 'hue-rotate(100deg)';
    if (hue >= 170 && hue <= 260) return 'hue-rotate(240deg)';
    if (hue >= 260 && hue <= 320) return 'hue-rotate(280deg)';
  }
  return 'none';
}

/**
 * Simplify color to a canonical bucket for clash detection (same bucket = same perceived color).
 */
function simplifyColor(color) {
  if (!color) return 'red';
  const c = String(color).toLowerCase();
  if (c.includes('yellow') || c.includes('gold')) return 'yellow';
  if (c.includes('green')) return 'green';
  if (c.includes('blue') || c.includes('cyan')) return 'blue';
  if (c.includes('purple')) return 'purple';
  if (c.includes('red')) return 'red';
  const hex = c.replace(/^#/, '');
  if (hex.length === 6 && /^[0-9a-f]+$/.test(hex)) {
    const hue = hueFromHex(hex);
    if (hue >= 40 && hue <= 85) return 'yellow';
    if (hue >= 85 && hue <= 170) return 'green';
    if (hue >= 170 && hue <= 260) return 'blue';
    if (hue >= 260 && hue <= 320) return 'purple';
  }
  return 'red';
}

function GamePieceInner({ imagePath, alt, isHidden, isMine, myTeamColor, opponentTeamColor, displayColor }) {
  let finalFilter = 'none';
  if (isHidden) {
    finalFilter = 'brightness(1)';
  } else {
    const pieceRealColor = isMine ? myTeamColor : opponentTeamColor;
    const isClash = simplifyColor(myTeamColor) === simplifyColor(opponentTeamColor);
    finalFilter = getColorFilter(pieceRealColor);
    if (!isMine && isClash) {
      finalFilter = 'grayscale(100%) brightness(130%) sepia(50%) hue-rotate(190deg)';
    }
  }

  const style = {
    filter: finalFilter,
    boxShadow: `0 0 12px ${displayColor || '#64748b'}aa`,
  };

  const imgProps = {
    src: imagePath,
    alt: alt || 'Unit',
    className: 'w-full h-full object-contain',
    style,
  };

  if (!imagePath) return null;

  if (isHidden) {
    return (
      <motion.img
        {...imgProps}
        animate={{ scale: [1, 1.05, 1], rotate: [-2, 2, -2] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    );
  }

  return (
    <motion.img
      {...imgProps}
      initial={{ scale: 0.9, opacity: 0.8 }}
      animate={{ scale: [1, 1.04, 1], opacity: 1 }}
      transition={{ scale: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } }}
    />
  );
}

const GamePiece = memo(GamePieceInner);

export default GamePiece;
export { simplifyColor };
