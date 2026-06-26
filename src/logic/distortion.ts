// Builds K frames of progressive word-slot destruction starting from a source
// title. Frame 0 = original (centered words), frame K-1 = maximally distorted.
// Play in reverse to reveal the source title.
//
// N slots = max(word count, minSlots). Slots outside the word count are empty.
// Each slot is assigned a "protect time" T; on distortion step k, only slots
// with T <= k are eligible to be overwritten. Words come from the supplied
// donor titles (cycled with replacement if fewer than K).
export function buildDistortionFrames(
  sourceTitle: string,
  donorTitles: string[],
  K: number,
  minSlots = 4
): string[][] {
  const sourceWords = sourceTitle.trim().split(/\s+/).filter(Boolean);
  const N = Math.max(sourceWords.length, minSlots);

  const initial: string[] = Array(N).fill('');
  const offset = Math.floor((N - sourceWords.length) / 2);
  sourceWords.forEach((w, i) => { initial[offset + i] = w; });

  // Random permutation assigns protect times T[slot] = j * (K / N)
  const slotOrder = shuffled(Array.from({ length: N }, (_, i) => i));
  const T: number[] = Array(N).fill(0);
  slotOrder.forEach((slot, j) => { T[slot] = j * (K / N); });

  let current = [...initial];
  const frames: string[][] = [[...initial]]; // frame 0 = original

  for (let k = 0; k < K - 1; k++) {
    const available = Array.from({ length: N }, (_, n) => n).filter(n => T[n] <= k);
    if (available.length > 0 && donorTitles.length > 0) {
      const slot = available[Math.floor(Math.random() * available.length)];
      const donor = donorTitles[k % donorTitles.length];
      const donorWords = donor.trim().split(/\s+/).filter(Boolean);
      if (donorWords.length > 0) {
        current = [...current];
        current[slot] = donorWords[Math.floor(Math.random() * donorWords.length)];
      }
    }
    frames.push([...current]);
  }

  return frames; // frames[0] = original, frames[K-1] = most distorted
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
