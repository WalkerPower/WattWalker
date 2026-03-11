import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete, duration = 3000 }) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, duration - 500);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete, duration]);

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="flex flex-col items-center">
        <img 
          src="/splash.png" 
          alt="WattWalker" 
          className="w-64 h-64 object-contain animate-pulse"
        />
        <p className="mt-4 text-xl font-semibold text-gray-700">WattWalker</p>
      </div>
    </div>
  );
};

export default SplashScreen;
