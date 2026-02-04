import React from 'react';
import { BotStatus } from '../types';

interface ControlsProps {
  isListening: boolean;
  onToggleListening: () => void;
  botStatus: BotStatus;
  isSpeaking: boolean;
  isProcessing: boolean;
}

const Controls: React.FC<ControlsProps> = ({
  isListening,
  onToggleListening,
  botStatus,
  isSpeaking,
  isProcessing,
}) => {
  const buttonClasses = `
    p-4 rounded-full shadow-lg transition-all duration-300
    focus:outline-none focus:ring-4
    flex items-center justify-center
    w-16 h-16 md:w-20 md:h-20
  `;

  const micIcon = isListening ? (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-8 h-8 md:w-10 md:h-10 animate-pulse"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 6v-1.5m-6 1.5a6 6 0 0 1 6-6v-1.5m6 1.5a6 6 0 0 0-6 6M12 21.75v-3m0 0V2.25"
      />
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-8 h-8 md:w-10 md:h-10"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 6v-1.5m-6 1.5a6 6 0 0 1 6-6v-1.5m6 1.5a6 6 0 0 0-6 6m-3 2.25V21h6v-2.25m-3 0v-3.75m-3 0a3 3 0 0 1-3-3V9m3-3h.008v.008H12m0 6h.008v.008H12m-3 0h.008v.008H9m6 0h.008v.008H15m-3 3h.008v.008H12m-3 0h.008v.008H9m6 0h.008v.008H15m-3 3a3 3 0 0 0 3-3V9m-6 0V7.5a3 3 0 0 1 3-3h.008v.008H12m0 0a3 3 0 0 1 3 3V9m-6-3V7.5a3 3 0 0 0-3-3H9m-3 0a3 3 0 0 1 3 3V9"
      />
    </svg>
  );

  // Disable if processing, speaking, or in an error state
  const isDisabled = isProcessing || isSpeaking || botStatus === BotStatus.Error;

  return (
    <div className="sticky bottom-0 bg-purple-900 bg-opacity-90 p-4 md:p-6 flex flex-col items-center justify-center border-t border-purple-700 shadow-xl z-10 w-full">
      <div className="mb-4 text-center">
        <p
          className={`text-lg md:text-xl font-semibold ${
            botStatus === BotStatus.Error ? 'text-red-400' : 'text-purple-200'
          }`}
        >
          {botStatus}
        </p>
      </div>
      <button
        onClick={onToggleListening}
        disabled={isDisabled}
        className={`${buttonClasses}
          ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 focus:ring-red-400'
              : 'bg-purple-500 hover:bg-purple-600 focus:ring-purple-400'
          }
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
          text-white
        `}
        aria-label={isListening ? 'Stop Listening' : 'Start Listening'}
      >
        {micIcon}
      </button>
      <p className="mt-2 text-sm text-purple-300">
        {isListening ? 'Click to stop' : 'Click to speak'}
      </p>
    </div>
  );
};

export default Controls;