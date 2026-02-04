import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ChatWindow from './components/ChatWindow';
import TextInput from './components/TextInput';
import StatusDisplay from './components/StatusDisplay';
import { synthesizeAndPlaySpeech } from './services/geminiService';
import { ChatMessage, MessageSender, BotStatus } from './types';

// Define the AIStudio interface explicitly to avoid type conflicts
interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

// Extend the Window interface to include webkitAudioContext and aistudio API
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus>(BotStatus.Idle);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true); // Assume true initially, check on mount

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
    if (!hasApiKey) {
      addMessage(MessageSender.System, "Please select an API key first to enable the bot's voice.");
      return;
    }

    // Ensure audio context is running (required by some browsers for playback)
    if (outputAudioContextRef.current.state === 'suspended') {
      console.log('Resuming AudioContext...');
      await outputAudioContextRef.current.resume().catch(e => {
        console.error("Error resuming AudioContext:", e);
        addMessage(MessageSender.System, "Failed to resume audio. Please ensure your browser allows audio playback.");
        setBotStatus(BotStatus.Error);
        return;
      });
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

      if (!audioPlayed) {
        setBotStatus(BotStatus.Idle); // Reset if no audio was generated
      }
      // If audio was played, handleSpeechPlaybackEnded will eventually set status to Idle.

    } catch (error: any) {
      console.error('Error synthesizing speech:', error);
      setBotStatus(BotStatus.Error); // Set global error status
      handleSpeechPlaybackEnded(); // Ensure processing/speaking flags are reset immediately
      addMessage(MessageSender.System, "I'm sorry, I encountered an error while speaking. Please try again.");

      // Specific error handling for API Key issues
      const errorMessage = error?.message || '';
      const status = error?.status;

      if (errorMessage.includes("API_KEY is missing") || status === 401 || status === 403 || (errorMessage.includes("Requested entity was not found."))) {
        setHasApiKey(false); // Invalidate API key state
        addMessage(
          MessageSender.System,
          "It looks like your API key is invalid or not selected. Please select a valid API key from a paid GCP project to continue. " +
          "You can find more information here: ai.google.dev/gemini-api/docs/billing"
        );
      }
    }
  }, [
    outputAudioContextRef, outputGainNodeRef, nextStartTimeRef, hasApiKey,
    addMessage, handleSpeechPlaybackStarted, handleSpeechPlaybackEnded,
    setBotStatus, setIsProcessing
  ]);

  const handleSelectApiKey = useCallback(async () => {
    if (window.aistudio?.openSelectKey) {
      try {
        await window.aistudio.openSelectKey();
        // Assume success for race condition mitigation as per guidelines
        setHasApiKey(true);
        addMessage(MessageSender.System, "API key selected. You can now type and I will speak! ✨");
        setBotStatus(BotStatus.Idle); // Clear any previous error state related to key
      } catch (error) {
        console.error("Error opening API Key selection:", error);
        addMessage(MessageSender.System, "Failed to open API Key selection. Please try again.");
      }
    } else {
      addMessage(MessageSender.System, "API Key selection tool not available. Ensure you are in the correct environment.");
      console.error("window.aistudio.openSelectKey is not available.");
    }
  }, [addMessage]);


  // Main useEffect for initial setup (AudioContext and API Key check)
  useEffect(() => {
    outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 24000,
    });
    outputGainNodeRef.current = outputAudioContextRef.current.createGain();
    outputGainNodeRef.current.connect(outputAudioContextRef.current.destination);

    // Initial bot greeting
    addMessage(MessageSender.Bot, "Hello! Type something and I'll speak it for you. 😄");

    // Check for API key presence
    if (window.aistudio?.hasSelectedApiKey) {
      window.aistudio.hasSelectedApiKey().then(selected => {
        setHasApiKey(selected);
        if (!selected) {
          addMessage(MessageSender.System, "Please select an API key to enable my voice. Click the button below!");
          setBotStatus(BotStatus.Error); // Indicate a required action
        }
      }).catch(e => {
        console.error("Error checking API key selection:", e);
        setHasApiKey(false);
        addMessage(MessageSender.System, "Could not verify API key status. Please try selecting one.");
        setBotStatus(BotStatus.Error);
      });
    } else {
      // If aistudio is not available, assume API key should be present in process.env
      // If it's not, the geminiService will catch it.
      addMessage(MessageSender.System, "If you encounter errors, ensure your environment's API_KEY is set or the API key selection tool is available.");
      setHasApiKey(true); // Optimistically assume it's configured externally if aistudio isn't present
    }


    return () => {
      outputAudioContextRef.current?.close();
    };
  }, [addMessage]);

  // Determine if the input/send button should be disabled
  const isDisabled = isProcessing || isSpeaking || !hasApiKey;

  return (
    <div className="flex flex-col h-screen w-full bg-gradient-to-br from-purple-900 to-indigo-900 text-purple-100">
      <header className="py-4 px-6 md:py-6 md:px-10 bg-purple-900 shadow-md text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
          SAMRIDHA'S BOT
        </h1>
        <p className="text-purple-300 text-sm md:text-base mt-1">Your purplish AI companion</p>
      </header>

      <ChatWindow messages={messages} />

      {!hasApiKey && (
        <div className="flex justify-center p-4">
          <button
            onClick={handleSelectApiKey}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
            aria-label="Select API Key"
          >
            Select API Key
          </button>
        </div>
      )}

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