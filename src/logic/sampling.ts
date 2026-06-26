import type { Album, Listen } from '../model/types';

export interface SamplingSettings {
  ratingWeight: number;
  priorityDecay: number;
  sampleTemperature: number;
  ratingDecay: number;
  unratedQuantile: number;
}

const RATING_VALUES: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };
const MIN_RATED_ALBUMS = 3;

function ratedListensByRecency(albumId: string, listens: Listen[]): Listen[] {
  return listens
    .filter(l => l.albumId === albumId && l.rating in RATING_VALUES)
    .sort((a, b) => (a.date === b.date ? b.index - a.index : b.date.localeCompare(a.date)));
}

export function averageRating(albumId: string, listens: Listen[], ratingDecay: number): number | null {
  const rated = ratedListensByRecency(albumId, listens);
  if (rated.length === 0) return null;

  let weightedSum = 0;
  let weightTotal = 0;
  rated.forEach((listen, k) => {
    const w = Math.pow(ratingDecay, k);
    weightedSum += w * RATING_VALUES[listen.rating];
    weightTotal += w;
  });
  return weightedSum / weightTotal;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = q * (sorted.length - 1);
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
}

export function computeWeights(albums: Album[], listens: Listen[], settings: SamplingSettings): Map<string, number> {
  const ratedWeights = new Map<string, number>();
  for (const album of albums) {
    const avg = averageRating(album.id, listens, settings.ratingDecay);
    if (avg !== null) ratedWeights.set(album.id, Math.pow(avg, settings.ratingWeight));
  }

  const weights = new Map<string, number>();
  if (ratedWeights.size < MIN_RATED_ALBUMS) {
    for (const album of albums) weights.set(album.id, 1);
    return weights;
  }

  const sortedRated = [...ratedWeights.values()].sort((a, b) => a - b);
  const fallback = quantile(sortedRated, settings.unratedQuantile);
  for (const album of albums) {
    weights.set(album.id, ratedWeights.get(album.id) ?? fallback);
  }
  return weights;
}

function gumbelSample(temperature: number): number {
  const u = Math.max(Math.random(), Number.EPSILON);
  return -Math.log(-Math.log(u)) * temperature;
}

// Top-k albums sorted by Gumbel-perturbed priority score, highest first.
// Index 0 is the drawn album. k is capped at pool size.
export function drawTopK(albums: Album[], settings: SamplingSettings, k: number): Album[] {
  const pool = albums.filter(a => !a.muted);
  if (pool.length === 0) return [];

  const scored = pool.map(album => ({
    album,
    score: album.priority + gumbelSample(settings.sampleTemperature),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map(s => s.album);
}

export function drawSample(albums: Album[], settings: SamplingSettings): Album | null {
  return drawTopK(albums, settings, 1)[0] ?? null;
}

export function applyDraw(
  albums: Album[],
  weights: Map<string, number>,
  chosenId: string,
  settings: SamplingSettings
): Map<string, number> {
  const priorities = new Map<string, number>();
  for (const album of albums) {
    if (album.muted) {
      priorities.set(album.id, album.priority);
      continue;
    }
    const decay = album.id === chosenId ? settings.priorityDecay : 0;
    const weight = weights.get(album.id) ?? 0;
    priorities.set(album.id, album.priority - decay + weight);
  }
  return priorities;
}
