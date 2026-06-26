import { create } from 'zustand';
import { DocumentGateway } from '../gateways/document';
import { PlayerGateway, type SpotifyDevice } from '../gateways/player';
import { useSettings } from './settings';
import * as config from '../model/config';

function ctx() {
  return { gateway: DocumentGateway.getInstance(), spreadsheetId: useSettings.getState().spreadsheetId };
}

// Determines the device to pass to the queue call, and whether queuing should be disabled.
// Returns deviceId=null when no preference (let Spotify pick), disabled=true when queuing is blocked.
export function resolveQueueTarget(
  savedDeviceIds: string[],
  availableDevices: SpotifyDevice[] | null,
): { deviceId: string | null; disabled: boolean } {
  if (savedDeviceIds.length === 0) return { deviceId: null, disabled: false };
  // Available devices not yet fetched — don't block, let Spotify handle it.
  if (availableDevices === null) return { deviceId: null, disabled: false };

  const activeDevices = availableDevices.filter(d => d.is_active && !d.is_restricted);

  // Active saved device: pick the highest-priority one (first in savedDeviceIds order).
  for (const id of savedDeviceIds) {
    if (activeDevices.some(d => d.id === id)) return { deviceId: id, disabled: false };
  }

  // Active device not in saved list → supercede the list.
  if (activeDevices.length > 0) return { deviceId: activeDevices[0].id, disabled: false };

  // No active devices — fall back to any saved device that's in the available list.
  const availableSet = new Set(availableDevices.filter(d => !d.is_restricted).map(d => d.id));
  for (const id of savedDeviceIds) {
    if (availableSet.has(id)) return { deviceId: id, disabled: false };
  }

  return { deviceId: null, disabled: true };
}

interface SpotifyDevicesState {
  savedDeviceIds: string[];
  savedLoaded: boolean;
  availableDevices: SpotifyDevice[] | null;
  saving: boolean;
  refreshing: boolean;
  error: string | null;
  loadSaved: () => Promise<void>;
  saveSaved: (ids: string[]) => Promise<void>;
  refreshAvailable: () => Promise<void>;
}

export const useSpotifyDevicesStore = create<SpotifyDevicesState>((set, get) => ({
  savedDeviceIds: [],
  savedLoaded: false,
  availableDevices: null,
  saving: false,
  refreshing: false,
  error: null,

  async loadSaved() {
    if (get().savedLoaded) return;
    try {
      const { gateway, spreadsheetId } = ctx();
      const ids = await config.loadSpotifyDeviceIds(gateway, spreadsheetId);
      set({ savedDeviceIds: ids, savedLoaded: true });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  async saveSaved(ids) {
    set({ saving: true, error: null });
    try {
      const { gateway, spreadsheetId } = ctx();
      await config.saveSpotifyDeviceIds(gateway, spreadsheetId, ids);
      set({ savedDeviceIds: ids, saving: false });
    } catch (err) {
      set({ error: String(err), saving: false });
    }
  },

  async refreshAvailable() {
    if (!PlayerGateway.getInstance().isAuthorized()) return;
    set({ refreshing: true, error: null });
    try {
      const devices = await PlayerGateway.getInstance().getDevices();
      set({ availableDevices: devices, refreshing: false });
    } catch (err) {
      set({ error: String(err), refreshing: false });
    }
  },
}));
