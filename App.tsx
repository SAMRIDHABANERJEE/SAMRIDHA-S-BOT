import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ChatWindow from './components/ChatWindow';
import TextInput from './components/TextInput'; // New component
import StatusDisplay from './components/StatusDisplay'; // Renamed component
import { synthesizeAndPlaySpeech } from './services/geminiService'; // Updated service function
import { ChatMessage, MessageSender, BotStatus } from './types';

// Extend the Window interface to include webkitAudioContext
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus>(BotStatus.Idle);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputGainNodeRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  // Callback to add a new message, kept stable
  const addMessage = useCallback((sender: MessageSender, text: string) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { id: uuidv4(), sender, text },
    ]);
  }, []);

  const handleSpeechPlaybackStarted = useCallback(() => {
    setIsSpeaking(true);
  }, []);

  const handleSpeechPlaybackEnded = useCallback(() => {
    setIsSpeaking(false);
    setIsProcessing(false); // Finished processing and speaking
    setBotStatus(BotStatus.Idle); // Reset status when done
    nextStartTimeRef.current = outputAudioContextRef.current?.currentTime || 0; // Reset nextStartTime to current time
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!outputAudioContextRef.current || !outputGainNodeRef.current) {
      console.error('Audio context not initialized.');
      setBotStatus(BotStatus.Error);
      addMessage(MessageSender.System, "Audio system not ready. Please refresh the page.");
      return;
    }

    addMessage(MessageSender.User, text); // Add user's message to chat

    setIsProcessing(true); // Indicate that we are now processing the command
    setBotStatus(BotStatus.Processing);

    try {
      await synthesizeAndPlaySpeech(
        text,
        outputAudioContextRef.current,
        outputGainNodeRef.current,
        nextStartTimeRef,
        (status) => {
          setBotStatus(status);
          if (status === BotStatus.Speaking) {
            handleSpeechPlaybackStarted();
          }
        },
        handleSpeechPlaybackEnded,
      );
    } catch (error) {
      console.error('Error synthesizing speech:', error);
      setBotStatus(BotStatus.Error);
      handleSpeechPlaybackEnded(); // Ensure status is reset even on error
      addMessage(MessageSender.System, "I'm sorry, I encountered an error while speaking. Please try again.");
    }
  }, [
    outputAudioContextRef, outputGainNodeRef, nextStartTimeRef,
    addMessage, handleSpeechPlaybackStarted, handleSpeechPlaybackEnded,
    setBotStatus, setIsProcessing
  ]);

  // Main useEffect for initial setup (AudioContext)
  useEffect(() => {
    outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 24000,
    });
    outputGainNodeRef.current = outputAudioContextRef.current.createGain();
    outputGainNodeRef.current.connect(outputAudioContextRef.current.destination);

    // Initial bot greeting
    addMessage(MessageSender.Bot, "Hello! Type something and I'll speak it for you. 😄");


    return () => {
      outputAudioContextRef.current?.close();
    };
  }, [addMessage]);

  const isDisabled = isProcessing || isSpeaking;

  return (
    <div className="flex flex-col h-screen w-full bg-gradient-to-br from-purple-900 to-indigo-900 text-purple-100">
      <header className="py-4 px-6 md:py-6 md:px-10 bg-purple-900 shadow-md text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
          SAMRIDHA'S BOT
        </h1>
        <p className="text-purple-300 text-sm md:text-base mt-1">Your purplish AI companion</p>
      </header>

      <ChatWindow messages={messages} />

      <TextInput onSendMessage={handleSendMessage} isDisabled={isDisabled} />

      <StatusDisplay
        botStatus={botStatus}
        isSpeaking={isSpeaking}
        isProcessing={isProcessing}
      />
    </div>
  );
};

export default App;