import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GoogleAuthState {
  googleAccessToken: string | null;
  googleRefreshToken: string | null;
  setGoogleTokens: (accessToken: string, refreshToken: string | null) => void;
  clearGoogleAuth: () => void;
}

export const useGoogleAuth = create<GoogleAuthState>()(
  persist(
    (set) => ({
      googleAccessToken: null,
      googleRefreshToken: null,
      setGoogleTokens: (accessToken, refreshToken) =>
        set({ googleAccessToken: accessToken, googleRefreshToken: refreshToken }),
      clearGoogleAuth: () => set({ googleAccessToken: null, googleRefreshToken: null }),
    }),
    { name: 'google-auth' }
  )
);
