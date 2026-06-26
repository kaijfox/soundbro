import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  clientId: string;
  clientSecret: string;
  apiKey: string;
  spreadsheetId: string;
  googleUser: string;
  setClientId: (v: string) => void;
  setClientSecret: (v: string) => void;
  setApiKey: (v: string) => void;
  setSpreadsheetId: (v: string) => void;
  setGoogleUser: (v: string) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      clientId: '',
      clientSecret: '',
      apiKey: '',
      spreadsheetId: '',
      googleUser: '',
      setClientId: (v) => set({ clientId: v }),
      setClientSecret: (v) => set({ clientSecret: v }),
      setApiKey: (v) => set({ apiKey: v }),
      setSpreadsheetId: (v) => set({ spreadsheetId: v }),
      setGoogleUser: (v) => set({ googleUser: v }),
    }),
    { name: 'albums-settings' }
  )
);
