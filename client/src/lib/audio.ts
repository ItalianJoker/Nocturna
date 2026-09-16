/**
 * @fileoverview Ambient night audio via Howler.
 *
 * Uses an inline procedural WAV data-URI (soft noise bed) so the repo has
 * zero third-party copyrighted audio assets. Volume stays low — masking
 * touch clicks, not startling sleepers through closed eyelids.
 */

import { Howl } from 'howler';

let ambient: Howl | null = null;
let started = false;

/** Tiny looping soft-noise WAV generated at module load. */
function softNoiseDataUri(): string {
  const sampleRate = 8000;
  const seconds = 2;
  const numSamples = sampleRate * seconds;
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let seed = 1;
  for (let i = 0; i < numSamples; i++) {
    // xorshift-ish soft noise, heavily attenuated.
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const n = ((seed & 0xffff) / 0xffff) * 2 - 1;
    const envelope = 0.15 + 0.1 * Math.sin((i / sampleRate) * Math.PI * 2);
    const sample = Math.max(-1, Math.min(1, n * 0.04 * envelope));
    view.setInt16(44 + i * 2, sample * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function ensure(): Howl {
  if (!ambient) {
    ambient = new Howl({
      src: [softNoiseDataUri()],
      loop: true,
      volume: 0.22,
      preload: true,
    });
  }
  return ambient;
}

export function playAmbient(): void {
  const sound = ensure();
  if (!started) {
    sound.play();
    started = true;
  } else if (!sound.playing()) {
    sound.play();
  }
}

export function stopAmbient(): void {
  if (ambient && started) {
    ambient.stop();
    started = false;
  }
}
