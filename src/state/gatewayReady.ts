import { create } from 'zustand';

interface GatewayReadyState {
  ready: boolean;
  setReady: () => void;
}

export const useGatewayReady = create<GatewayReadyState>((set) => ({
  ready: false,
  setReady: () => set({ ready: true }),
}));
