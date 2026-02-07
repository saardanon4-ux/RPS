import React, { useEffect, useState } from 'react';

const ASSET_COLORS = [
  'red', 'blue', 'green', 'yellow',
  'whiteandred', 'blackandred', 'blackandyellow', 'lightblue'
];

const ASSET_TYPES = [
  'rock', 'paper', 'scissors', 'flag', 'trap', 'hidden'
];

const AssetPreloader = ({ onComplete }) => {
  const [loadedCount, setLoadedCount] = useState(0);
  const totalAssets = ASSET_COLORS.length * ASSET_TYPES.length;

  useEffect(() => {
    let loaded = 0;

    const loadImage = (src) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
          loaded++;
          setLoadedCount(loaded);
          resolve(src);
        };
        img.onerror = () => {
          console.warn(`Failed to preload: ${src}`);
          loaded++;
          setLoadedCount(loaded);
          resolve(src);
        };
      });
    };

    const loadAll = async () => {
      const promises = [];

      ASSET_COLORS.forEach((color) => {
        ASSET_TYPES.forEach((type) => {
          promises.push(loadImage(`/assets/units/${color}.${type}.png`));
        });
      });

      await Promise.all(promises);

      setTimeout(() => {
        onComplete?.();
      }, 500);
    };

    loadAll();
  }, [onComplete]);

  const progress = totalAssets > 0 ? Math.round((loadedCount / totalAssets) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center z-50">
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
      <h2 className="text-white text-xl font-bold mb-2">מכין את הלוח...</h2>
      <div className="w-64 h-4 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-gray-400 text-sm mt-2">{progress}%</p>
    </div>
  );
};

export default AssetPreloader;
