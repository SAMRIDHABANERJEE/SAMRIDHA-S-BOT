import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ChatWindow from './components/ChatWindow';
import TextInput from './components/TextInput';
import StatusDisplay from './components/StatusDisplay';
import { synthesizeAndPlaySpeech } from './services/geminiService';
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
    setBotStatus(BotStatus.Speaking); // Set speaking status when playback actually starts
  }, []);

  const handleSpeechPlaybackEnded = useCallback(() => {
    setIsSpeaking(false);
    setIsProcessing(false); // Playback finished, so processing is also done
    // IMPORTANT: Do NOT reset botStatus to Idle here.
    // It will be explicitly set to Idle or Error by handleSendMessage based on overall flow.
    nextStartTimeRef.current = outputAudioContextRef.current?.currentTime || 0;
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!outputAudioContextRef.current || !outputGainNodeRef.current) {
      console.error('Audio context not initialized.');
      setBotStatus(BotStatus.Error);
      addMessage(MessageSender.System, "Audio system not ready. Please refresh the page.");
      return;
    }

    addMessage(MessageSender.User, text);

    setIsProcessing(true); // Start processing
    setBotStatus(BotStatus.Processing); // Update bot status

    try {
      const audioPlayed = await synthesizeAndPlaySpeech(
        text,
        outputAudioContextRef.current,
        outputGainNodeRef.current,
        nextStartTimeRef,
        handleSpeechPlaybackStarted, // Callback for when audio playback starts
        handleSpeechPlaybackEnded,   // Callback for when audio playback ends
      );

      // If no audio was played (e.g., API returned no audio data),
      // handleSpeechPlaybackEnded has already been called (which resets isProcessing/isSpeaking).
      // We explicitly set botStatus to Idle here for this no-audio-played scenario.
      if (!audioPlayed) {
        setBotStatus(BotStatus.Idle);
      }
      // If audioPlayed is true, handleSpeechPlaybackEnded will eventually be called
      // via the 'ended' event listener, which will reset isProcessing/isSpeaking.
      // The botStatus will transition from 'Processing' -> 'Speaking' -> 'Idle' as playback completes.
      // We don't set Idle here if audioPlayed is true, as handleSpeechPlaybackEnded will signal completion.

    } catch (error) {
      console.error('Error synthesizing speech:', error);
      setBotStatus(BotStatus.Error); // Set global error status
      handleSpeechPlaybackEnded(); // Ensure processing/speaking flags are reset immediately
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

  // Determine if the input/send button should be disabled
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