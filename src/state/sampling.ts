import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SamplingSettings } from '../sampling';

interface SamplingSettingsState extends SamplingSettings {
  setRatingWeight: (v: number) => void;
  setPriorityDecay: (v: number) => void;
  setSampleTemperature: (v: number) => void;
  setRatingDecay: (v: number) => void;
  setUnratedQuantile: (v: number) => void;
}

export const useSamplingSettings = create<SamplingSettingsState>()(
  persist(
    (set) => ({
      ratingWeight: 1,
      priorityDecay: 1,
      sampleTemperature: 1,
      ratingDecay: 0.5,
      unratedQuantile: 0.5,
      setRatingWeight: (v) => set({ ratingWeight: v }),
      setPriorityDecay: (v) => set({ priorityDecay: v }),
      setSampleTemperature: (v) => set({ sampleTemperature: v }),
      setRatingDecay: (v) => set({ ratingDecay: v }),
      setUnratedQuantile: (v) => set({ unratedQuantile: v }),
    }),
    { name: 'sampling-settings' }
  )
);
