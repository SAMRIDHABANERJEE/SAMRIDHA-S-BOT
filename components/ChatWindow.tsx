import React, { useRef, useEffect } from 'react';
import { ChatMessage, MessageSender } from '../types';

interface ChatWindowProps {
  messages: ChatMessage[];
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 max-w-3xl mx-auto w-full">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${
            message.sender === MessageSender.User ? 'justify-end' : 'justify-start'
          }`}
        >
          <div
            className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-lg shadow-md ${
              message.sender === MessageSender.User
                ? 'bg-purple-600 text-white'
                : message.sender === MessageSender.Bot
                ? 'bg-purple-800 text-purple-100'
                : 'bg-gray-700 text-gray-200 italic' // For system messages
            }`}
          >
            {message.sender === MessageSender.Bot && (
              <span className="font-bold text-purple-200 block mb-1">SAMRIDHA'S BOT</span>
            )}
            <p className="whitespace-pre-wrap">{message.text}</p>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatWindow;