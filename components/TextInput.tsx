import React, { useState } from 'react';

interface TextInputProps {
  onSendMessage: (text: string) => void;
  isDisabled: boolean;
}

const TextInput: React.FC<TextInputProps> = ({ onSendMessage, isDisabled }) => {
  const [inputText, setInputText] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isDisabled) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center p-4 md:p-6 bg-purple-900 border-t border-purple-700 shadow-xl z-10">
      <input
        type="text"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="Type your message here..."
        className="flex-1 p-3 rounded-lg bg-purple-800 text-purple-100 border border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder-purple-400 transition-colors duration-200 mr-2"
        disabled={isDisabled}
        aria-label="Type your message"
      />
      <button
        type="submit"
        className={`px-6 py-3 rounded-lg font-semibold shadow-md transition-all duration-300
          ${isDisabled ? 'bg-gray-500 opacity-50 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400'}
          text-white
        `}
        disabled={isDisabled}
        aria-label="Send message"
      >
        Send
      </button>
    </form>
  );
};

export default TextInput;