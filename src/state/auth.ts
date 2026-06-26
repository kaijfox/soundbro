import { create } from 'zustand';

interface AuthState {
  authed: boolean;
  setAuthed: (v: boolean) => void;
}

export const useAuthState = create<AuthState>((set) => ({
  authed: false,
  setAuthed: (v) => set({ authed: v }),
}));
