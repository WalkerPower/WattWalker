import React from 'react';

interface LoadingStateProps {
  message?: string;
}

const LoadingState: React.FC<LoadingStateProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center h-full">
      <div className="relative w-16 h-16 mb-4">
        <div className="absolute inset-0 border-t-2 border-[#00a8f9] border-solid rounded-full animate-spin"></div>
        <div className="absolute inset-2 border-t-2 border-[#00ff0b] border-solid rounded-full animate-spin direction-reverse"></div>
      </div>
      <h3 className="text-lg font-bold text-slate-800">Processing...</h3>
      <p className="text-slate-500 mt-2 max-w-xs text-sm">
        {message || "Gemini is reading the bars and extracting data points..."}
      </p>
    </div>
  );
};

export default LoadingState;