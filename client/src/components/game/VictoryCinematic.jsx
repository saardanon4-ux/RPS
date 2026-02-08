import { useRef, useEffect, useState } from 'react';
import { getTeamPrimaryHex } from '../../utils/colors';

const VictoryCinematic = ({ winnerColor, onComplete }) => {
  const videoRef = useRef(null);
  const [showTapToPlay, setShowTapToPlay] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const videoSrc = `/assets/units/${winnerColor || 'red'}.celebration.mp4`;
  const primaryHex = getTeamPrimaryHex(winnerColor) || '#ef4444';
  const borderGlow = {
    boxShadow: `0 0 0 2px ${primaryHex}99, 0 0 32px ${primaryHex}66, 0 0 64px ${primaryHex}44`,
  };

  const tryPlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.play().then(() => {
      setIsPlaying(true);
      setShowTapToPlay(false);
    }).catch(() => {});
  };

  useEffect(() => {
    const safetyTimeout = setTimeout(onComplete, 8000);
    return () => clearTimeout(safetyTimeout);
  }, [onComplete]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    tryPlay();
    const onCanPlay = () => tryPlay();
    const onPlaying = () => {
      setIsPlaying(true);
      setShowTapToPlay(false);
    };

    video.addEventListener('loadeddata', tryPlay);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('canplaythrough', onCanPlay);
    video.addEventListener('playing', onPlaying);

    const retry = setInterval(tryPlay, 300);
    const stopRetry = setTimeout(() => clearInterval(retry), 2000);

    const showTapFallback = setTimeout(() => {
      if (!videoRef.current) return;
      if (videoRef.current.readyState >= 2 && !videoRef.current.paused) return;
      setShowTapToPlay(true);
    }, 1200);

    return () => {
      video.removeEventListener('loadeddata', tryPlay);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('canplaythrough', onCanPlay);
      video.removeEventListener('playing', onPlaying);
      clearInterval(retry);
      clearTimeout(stopRetry);
      clearTimeout(showTapFallback);
    };
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
          preload="auto"
          onEnded={onComplete}
          onError={() => onComplete()}
        />
        {showTapToPlay && !isPlaying && (
          <button
            type="button"
            className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px] text-white/95 text-sm sm:text-base font-medium focus:outline-none focus:ring-2 focus:ring-white/50 rounded-2xl"
            onClick={tryPlay}
          >
            <span className="px-4 py-2 rounded-xl bg-black/40">לצפייה בסרטון חגיגה</span>
          </button>
        )}
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
