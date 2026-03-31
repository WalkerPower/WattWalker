import React, { useEffect, useState, useRef } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete, duration = 5000 }) => {
  const [fadeOut, setFadeOut] = useState(false);
  const completedRef = useRef(false);

  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setFadeOut(true);
    setTimeout(onComplete, 500);
  };

  useEffect(() => {
    const fallbackTimer = setTimeout(finish, duration);
    return () => clearTimeout(fallbackTimer);
  }, [onComplete, duration]);

  const handleVideoEnded = () => finish();

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="flex flex-col items-center justify-center w-full h-full px-8">
        <video
          src="/splash.mp4"
          autoPlay
          muted
          playsInline
          onEnded={handleVideoEnded}
          className="max-w-full max-h-[80vh] object-contain"
        />
      </div>
    </div>
  );
};

export default SplashScreen;
