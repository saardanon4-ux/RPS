import { useRef, useEffect } from 'react';
import { getTeamPrimaryHex } from '../../utils/colors';

const VictoryCinematic = ({ winnerColor, onComplete }) => {
  const videoRef = useRef(null);

  const videoSrc = `/assets/units/${winnerColor || 'red'}.celebration.mp4`;
  const primaryHex = getTeamPrimaryHex(winnerColor) || '#ef4444';
  const borderGlow = {
    boxShadow: `0 0 0 2px ${primaryHex}99, 0 0 32px ${primaryHex}66, 0 0 64px ${primaryHex}44`,
  };

  useEffect(() => {
    const safetyTimeout = setTimeout(onComplete, 8000);
    return () => clearTimeout(safetyTimeout);
  }, [onComplete]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const play = () => video.play().catch(() => {});
    if (video.readyState >= 2) play();
    else video.addEventListener('loadeddata', play);
    return () => video.removeEventListener('loadeddata', play);
  }, [videoSrc]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-2xl aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black"
        style={borderGlow}
      >
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted
          onEnded={onComplete}
          onError={() => onComplete()}
        />
        <button
          type="button"
          onClick={onComplete}
          className="absolute bottom-3 right-3 text-white/90 hover:text-white bg-black/30 hover:bg-black/50 backdrop-blur-sm text-xs sm:text-sm px-3 py-1.5 rounded-lg transition"
        >
          דלג &gt;&gt;
        </button>
      </div>
    </div>
  );
};

export default VictoryCinematic;
