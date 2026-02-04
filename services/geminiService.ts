import { GoogleGenAI, Modality } from "@google/genai";
import { decodeBase64, decodeAudioData, playAudioBuffer } from '../utils/audioUtils';
import { BotStatus } from '../types';
import React from 'react';

const TTS_SAMPLE_RATE = 24000;
const TTS_CHANNELS = 1;

/**
 * Synthesizes speech from text using Gemini TTS and plays it.
 * @param text The text to convert to speech.
 * @param outputAudioContext The AudioContext for playing bot responses.
 * @param outputGainNode The GainNode for audio output.
 * @param nextStartTime A mutable ref for audio playback synchronization.
 * @param setBotStatus A callback to update the bot's status.
 * @param onPlaybackEnded A callback to signal when audio playback has fully completed.
 * @returns A promise that resolves when the entire speech has been synthesized and played.
 */
export async function synthesizeAndPlaySpeech(
  text: string,
  outputAudioContext: AudioContext,
  outputGainNode: GainNode,
  nextStartTime: React.MutableRefObject<number>,
  setBotStatus: (status: BotStatus) => void,
  onPlaybackEnded: () => void,
): Promise<void> {
  const currentSources = new Set<AudioBufferSourceNode>(); // Track sources for current response
  let audioPromises: Promise<void>[] = []; // To wait for all audio to finish

  // Callback for when individual audio chunks end
  const onSourceEnded = (source: AudioBufferSourceNode) => {
    currentSources.delete(source);
    if (currentSources.size === 0) {
      onPlaybackEnded();
    }
  };

  try {
    setBotStatus(BotStatus.Processing);

    // Create a new GenAI instance for TTS
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
      const audioPromise = (async () => {
        const decodedBytes = decodeBase64(base64Audio);
        const audioBuffer = await decodeAudioData(
          decodedBytes,
          outputAudioContext,
          TTS_SAMPLE_RATE,
          TTS_CHANNELS,
        );
        setBotStatus(BotStatus.Speaking); // Set status only when audio is actually ready to play
        const source = playAudioBuffer(audioBuffer, outputAudioContext, outputGainNode, nextStartTime);
        currentSources.add(source);
        source.addEventListener('ended', () => onSourceEnded(source));
      })();
      audioPromises.push(audioPromise);
    } else {
      console.warn('No audio data received from TTS.');
      setBotStatus(BotStatus.Error);
      onPlaybackEnded(); // Ensure playback ended is called even if no audio
      return;
    }

    await Promise.all(audioPromises); // Wait for all audio decoding and playback scheduling to complete
  } catch (error) {
    console.error('Error synthesizing and playing speech:', error);
    setBotStatus(BotStatus.Error);
    // Ensure onPlaybackEnded is called even if there's an error
    if (currentSources.size === 0) {
      onPlaybackEnded();
    }
    throw error; // Re-throw to be caught by the calling component
  } finally {
    // If no audio was played or an error occurred before audio, ensure status is reset
    if (currentSources.size === 0) {
       onPlaybackEnded(); // If no audio started playing, immediately call onPlaybackEnded
    }
  }
}