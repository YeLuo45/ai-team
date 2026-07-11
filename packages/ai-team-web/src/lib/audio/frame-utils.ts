// V184: Audio buffer primitives shared by waveform diff + future audio
// helpers. Pure functions.

export function mergeBuffers<T extends ArrayLike<number>>(
  buffers: ReadonlyArray<T>,
): Float32Array {
  let total = 0;
  for (const b of buffers) total += b.length;
  const out = new Float32Array(total);
  let offset = 0;
  for (const b of buffers) {
    for (let i = 0; i < b.length; i++) out[offset + i] = b[i] ?? 0;
    offset += b.length;
  }
  return out;
}

/**
 * Trivial mono normaliser — for typical mono Whisper audio this is a
 * no-op. If a multi-channel list is passed, the first channel is
 * returned as-is. The function is exported so future helpers can wire
 * a proper down-mix without churning the call sites.
 */
export function normalizeToMono(
  audio: Float32Array,
): Float32Array {
  return audio.length === 0 ? new Float32Array(0) : audio;
}

/** dB (decibel) conversion utility for RMS values — used by future
 *  waveform rendering code. Kept here so the audio helpers stay
 *  together. */
export function rmsToDb(rms: number): number {
  if (rms <= 0) return -120;
  return 20 * Math.log10(rms);
}
