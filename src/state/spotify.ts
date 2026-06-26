import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SpotifyState {
  spotifyClientId: string;
  spotifyAccessToken: string | null;
  spotifyRefreshToken: string | null;
  spotifyProfileName: string | null;
  setSpotifyClientId: (v: string) => void;
  setSpotifyTokens: (accessToken: string, refreshToken: string | null) => void;
  setSpotifyProfileName: (v: string | null) => void;
  clearSpotifyAuth: () => void;
}

export const useSpotifySettings = create<SpotifyState>()(
  persist(
    (set) => ({
      spotifyClientId: '',
      spotifyAccessToken: null,
      spotifyRefreshToken: null,
      spotifyProfileName: null,
      setSpotifyClientId: (v) => set({ spotifyClientId: v }),
      setSpotifyTokens: (accessToken, refreshToken) =>
        set({ spotifyAccessToken: accessToken, spotifyRefreshToken: refreshToken }),
      setSpotifyProfileName: (v) => set({ spotifyProfileName: v }),
      clearSpotifyAuth: () =>
        set({ spotifyAccessToken: null, spotifyRefreshToken: null, spotifyProfileName: null }),
    }),
    { name: 'spotify-settings' }
  )
);
