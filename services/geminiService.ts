import { GoogleGenAI, Modality } from "@google/genai";
import { decodeBase64, decodeAudioData, playAudioBuffer } from '../utils/audioUtils';
import React from 'react'; // Needed for React.MutableRefObject

const TTS_SAMPLE_RATE = 24000;
const TTS_CHANNELS = 1;

/**
 * Synthesizes speech from text using Gemini TTS and plays it.
 * @param text The text to convert to speech.
 * @param outputAudioContext The AudioContext for playing bot responses.
 * @param outputGainNode The GainNode for audio output.
 * @param nextStartTime A mutable ref for audio playback synchronization.
 * @param onPlaybackStarted A callback to signal when audio playback has started.
 * @param onPlaybackEnded A callback to signal when audio playback has fully completed.
 * @returns A promise that resolves to `true` if audio was played, `false` otherwise.
 *          Rejects if an API or audio processing error occurs.
 */
export async function synthesizeAndPlaySpeech(
  text: string,
  outputAudioContext: AudioContext,
  outputGainNode: GainNode,
  nextStartTime: React.MutableRefObject<number>,
  onPlaybackStarted: () => void, // New callback for when playback actually starts
  onPlaybackEnded: () => void,
): Promise<boolean> { // Returns boolean indicating if audio was played
  const currentSources = new Set<AudioBufferSourceNode>(); // Track sources for current response
  let playbackScheduled = false; // Flag to indicate if any audio was successfully scheduled for playback

  const onSourceEnded = (source: AudioBufferSourceNode) => {
    currentSources.delete(source);
    if (currentSources.size === 0) {
      onPlaybackEnded(); // All chunks for this utterance have finished
    }
  };

  try {
    // Basic check for API_KEY, crucial for debugging in client-side environment
    if (typeof process === 'undefined' || !process.env || !process.env.API_KEY) {
      console.error("process.env.API_KEY is not defined. Ensure your environment provides it, or use the API Key Selection mechanism if applicable.");
      throw new Error("API_KEY is missing from environment. Please select an API key.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    console.log("Sending TTS request to Gemini model for text:", text);
    const ttsResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // A pleasant voice name
          },
        },
      },
    });
    console.log("Received TTS response:", ttsResponse);

    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      console.log("Received base64 audio data. Length:", base64Audio.length);
      const decodedBytes = decodeBase64(base64Audio);
      const audioBuffer = await decodeAudioData(
        decodedBytes,
        outputAudioContext,
        TTS_SAMPLE_RATE,
        TTS_CHANNELS,
      );

      onPlaybackStarted();
      const source = playAudioBuffer(audioBuffer, outputAudioContext, outputGainNode, nextStartTime);
      currentSources.add(source);
      source.addEventListener('ended', () => onSourceEnded(source));
      playbackScheduled = true;
      console.log("Audio playback scheduled.");
    } else {
      console.warn('No audio data received from TTS for text:', text);
      // If no audio is received, playback logically ends immediately.
      onPlaybackEnded();
      return false; // No audio was played
    }

    // We can't await `source.addEventListener('ended')` directly within this function.
    // The `onPlaybackEnded` callback passed from App.tsx will handle signaling completion
    // to App.tsx when the last audio source finishes.
    return playbackScheduled;

  } catch (error: any) { // Type assertion for error to access potential properties
    console.error('Error in Gemini TTS service:', error);
    if (error.message && error.message.includes("API_KEY is missing")) {
        console.error("The API key is crucial for API calls. Please ensure it's configured.");
    }
    // Log specific error details from GoogleGenAI or network
    if (error.status) { // This is common for HTTP errors from GoogleGenAI
        console.error(`Gemini API Error Status: ${error.status}`);
        console.error(`Gemini API Error Message: ${error.message}`);
        console.error(`Gemini API Error Details: ${JSON.stringify(error.details)}`);
    } else if (error.response && error.response.data) { // Another potential error structure for Axios-like errors
        console.error(`Gemini API Error Response Data:`, error.response.data);
    } else if (error instanceof Error) {
        console.error(`General Error: ${error.name}: ${error.message}`);
    } else {
        console.error(`Unknown error type:`, error);
    }
    
    // If an error occurs and no audio was even scheduled, we still need to
    // ensure cleanup is triggered, as onPlaybackEnded won't be called via source.ended.
    if (!playbackScheduled) {
      onPlaybackEnded();
    }
    throw error; // Re-throw for App.tsx to catch
  }
}