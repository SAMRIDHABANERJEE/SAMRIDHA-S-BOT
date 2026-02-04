import React from 'react';

/**
 * Decodes a base64 string into a Uint8Array.
 * @param base64 The base64 string to decode.
 * @returns A Uint8Array containing the decoded bytes.
 */
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio data into an AudioBuffer.
 * This is necessary because the Gemini TTS API returns raw PCM, not a standard audio file format.
 * @param data A Uint8Array containing the raw PCM audio data.
 * @param ctx The AudioContext to use for creating the AudioBuffer.
 * @param sampleRate The sample rate of the audio data.
 * @param numChannels The number of audio channels (e.g., 1 for mono).
 * @returns A Promise that resolves with the decoded AudioBuffer.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Plays an AudioBuffer using the provided AudioContext.
 * Manages playback timing to ensure seamless concatenation of audio chunks.
 * @param audioBuffer The AudioBuffer to play.
 * @param outputAudioContext The AudioContext for playback.
 * @param outputNode The AudioNode to connect the source to.
 * @param nextStartTime A mutable reference to track the next available start time for audio playback.
 * @returns The AudioBufferSourceNode that started playback.
 */
export function playAudioBuffer(
  audioBuffer: AudioBuffer,
  outputAudioContext: AudioContext,
  outputNode: GainNode,
  nextStartTime: React.MutableRefObject<number>,
): AudioBufferSourceNode {
  // Update nextStartTime to ensure new audio starts after current audio or current time
  nextStartTime.current = Math.max(
    nextStartTime.current,
    outputAudioContext.currentTime,
  );

  const source = outputAudioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(outputNode);

  source.start(nextStartTime.current);
  nextStartTime.current = nextStartTime.current + audioBuffer.duration;

  return source;
}