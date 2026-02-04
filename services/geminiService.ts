import { GoogleGenAI, Modality } from "@google/genai";
import { decodeBase64, decodeAudioData, playAudioBuffer } from '../utils/audioUtils';
// Removed BotStatus import as it won't set status directly
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const decodedBytes = decodeBase64(base64Audio);
      const audioBuffer = await decodeAudioData(
        decodedBytes,
        outputAudioContext,
        TTS_SAMPLE_RATE,
        TTS_CHANNELS,
      );

      // Signal that audio playback is about to start
      onPlaybackStarted();
      const source = playAudioBuffer(audioBuffer, outputAudioContext, outputGainNode, nextStartTime);
      currentSources.add(source);
      source.addEventListener('ended', () => onSourceEnded(source));
      playbackScheduled = true;
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

  } catch (error) {
    console.error('Error in Gemini TTS service:', error);
    // If an error occurs and no audio was even scheduled, we still need to
    // ensure cleanup is triggered, as onPlaybackEnded won't be called via source.ended.
    if (!playbackScheduled) {
      onPlaybackEnded();
    }
    throw error; // Re-throw for App.tsx to catch
  }
}