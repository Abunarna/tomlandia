import React, { useEffect, useState } from 'react';
import { preloadImages } from '../utils/preload';

interface LoadingScreenProps {
  assets: string[];
  onComplete: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ assets, onComplete }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const minDisplayTime = 600;

    preloadImages(assets, (loaded, total) => {
      const percentage = Math.round((loaded / total) * 100);
      setProgress(percentage);
    }).then(() => {
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minDisplayTime - elapsed);

      setTimeout(() => {
        setProgress(100);
        setTimeout(onComplete, 300);
      }, remainingTime);
    });
  }, [assets, onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white select-none">
      <div className="w-80 max-w-md p-8 bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-800 text-center">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="animate-pulse w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
          <h2 className="text-lg font-bold tracking-widest text-emerald-400 uppercase">Loading World</h2>
        </div>

        <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden mb-4 p-0.5 border border-slate-800/80">
          <div
            className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full transition-all duration-200 ease-out shadow-[0_0_15px_rgba(16,185,129,0.4)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-slate-400 text-xs font-semibold tracking-widest uppercase">
          {progress}% Ready
        </p>
      </div>
    </div>
  );
};
