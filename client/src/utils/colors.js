/**
 * Maps group.color (asset filename prefix, e.g. 'whiteandred', 'lightblue') to CSS style objects.
 * Use for avatars, badges, and any element that can show a solid or gradient background.
 */
export const getTeamColorStyle = (assetName) => {
  const name = assetName?.toLowerCase() || 'gray';

  switch (name) {
    // Single Colors
    case 'red':
      return { backgroundColor: '#ef4444' }; // Red-500
    case 'blue':
      return { backgroundColor: '#3b82f6' }; // Blue-500
    case 'green':
      return { backgroundColor: '#22c55e' }; // Green-500
    case 'yellow':
      return { backgroundColor: '#eab308' }; // Yellow-500

    // Special / Dual Colors (Gradients)
    case 'lightblue':
      return { backgroundColor: '#0ea5e9' }; // Sky-500

    case 'whiteandred': // Hapoel JLM / Beer Sheva
      return {
        background: 'linear-gradient(135deg, #ffffff 30%, #ef4444 100%)',
        border: '1px solid #ddd',
      };

    case 'blackandred': // Hapoel Haifa / Ashdod
      return {
        background: 'linear-gradient(135deg, #000000 30%, #ef4444 100%)',
      };

    case 'blackandyellow': // Beitar
      return {
        background: 'linear-gradient(135deg, #000000 30%, #eab308 100%)',
      };

    case 'whiteandblack':
      return {
        background: 'linear-gradient(135deg, #ffffff 30%, #000000 100%)',
        border: '1px solid #ddd',
      };

    default:
      return { backgroundColor: '#9ca3af' }; // Gray fallback
  }
};

/**
 * Returns a single hex color for the team (for shadows, small dots, or when gradient isn't suitable).
 * For dual-colored teams, returns the accent (second) color.
 */
export const getTeamPrimaryHex = (assetName) => {
  const name = assetName?.toLowerCase() || 'gray';
  switch (name) {
    case 'red':
      return '#ef4444';
    case 'blue':
      return '#3b82f6';
    case 'green':
      return '#22c55e';
    case 'yellow':
      return '#eab308';
    case 'lightblue':
      return '#0ea5e9';
    case 'whiteandred':
    case 'blackandred':
      return '#ef4444';
    case 'blackandyellow':
      return '#eab308';
    case 'whiteandblack':
      return '#000000';
    default:
      return '#9ca3af';
  }
};
