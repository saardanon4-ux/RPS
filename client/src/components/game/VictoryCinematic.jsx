import { useRef, useEffect } from 'react';

const VictoryCinematic = ({ winnerColor, onComplete }) => {
  const videoRef = useRef(null);

  // הנתיב: /assets/units/red.celebration.mp4
  const videoSrc = `/assets/units/${winnerColor || 'red'}.celebration.mp4`;

  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      onComplete();
    }, 8000);
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
    <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center">
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
        className="absolute bottom-10 right-10 bg-white/20 hover:bg-white/40 text-white px-6 py-2 rounded-full backdrop-blur-md transition"
      >
        דלג &gt;&gt;
      </button>
    </div>
  );
};

export default VictoryCinematic;
