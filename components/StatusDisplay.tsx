import React from 'react';
import { BotStatus } from '../types';

interface StatusDisplayProps {
  botStatus: BotStatus;
  isSpeaking: boolean;
  isProcessing: boolean;
}

const StatusDisplay: React.FC<StatusDisplayProps> = ({
  botStatus,
}) => {
  return (
    <div className="sticky bottom-0 bg-purple-900 bg-opacity-90 p-4 md:p-6 flex flex-col items-center justify-center border-t border-purple-700 shadow-xl z-10 w-full">
      <div className="text-center">
        <p
          className={`text-lg md:text-xl font-semibold ${
            botStatus === BotStatus.Error ? 'text-red-400' : 'text-purple-200'
          }`}
        >
          {botStatus}
        </p>
      </div>
    </div>
  );
};

export default StatusDisplay;