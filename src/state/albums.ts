import { create } from 'zustand';
import { DocumentGateway } from '../gateways/document';
import { useSettings } from './settings';
import { useSamplingSettings } from './sampling';
import * as model from '../model/albums';
import { computeWeights, drawTopK, applyDraw } from '../logic/sampling';
import type { Album, Listen } from '../model/types';

function ctx() {
  return { gateway: DocumentGateway.getInstance(), spreadsheetId: useSettings.getState().spreadsheetId };
}

interface AlbumsState {
  albums: Album[] | null;
  listens: Listen[] | null;
  rowIndex: Map<string, number>;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  markListen: (albumId: string, rating?: string) => Promise<void>;
  rateListen: (albumId: string, listenIndex: number, rating: string) => Promise<void>;
  toggleMuted: (albumId: string, muted: boolean) => Promise<void>;
  mergeSpotifyMetadata: (albumId: string, metadata: model.SpotifyMetadata) => Promise<void>;
  addAlbum: (newAlbum: model.NewAlbum) => Promise<Album>;
  drawSample: () => Promise<{ drawn: Album | null; topK: Album[] }>;
}

// Shared by every mutation: run the model call, and on a stale-cache result
// reload the whole sheet and surface an error instead of guessing what changed.
async function applyMutation(
  get: () => AlbumsState,
  set: (partial: Partial<AlbumsState>) => void,
  albumId: string,
  run: (rowIndex: number) => Promise<model.MutationResult>,
  onSuccess: () => void
): Promise<void> {
  const rowIndex = get().rowIndex.get(albumId);
  if (rowIndex === undefined) {
    set({ error: 'Album not found.' });
    return;
  }
  const result = await run(rowIndex);
  if (!result.ok) {
    set({ error: 'Data changed elsewhere — reloaded, please retry.' });
    await get().load();
    return;
  }
  onSuccess();
}

export const useAlbumsStore = create<AlbumsState>((set, get) => ({
  albums: null,
  listens: null,
  rowIndex: new Map(),
  loading: false,
  error: null,

  async load() {
    set({ loading: true, error: null });
    try {
      const { gateway, spreadsheetId } = ctx();
      const { albums, listens, rowIndex } = await model.loadAlbums(gateway, spreadsheetId);
      set({ albums, listens, rowIndex, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  async markListen(albumId, rating = '') {
    const { gateway, spreadsheetId } = ctx();
    await applyMutation(get, set, albumId, rowIndex => model.addListen(gateway, spreadsheetId, rowIndex, albumId, rating), () => {
      const listens = get().listens ?? [];
      const index = listens.filter(l => l.albumId === albumId).length;
      set({ listens: [...listens, { albumId, index, date: model.todayStamp(), rating }] });
    });
  },

  async rateListen(albumId, listenIndex, rating) {
    const { gateway, spreadsheetId } = ctx();
    await applyMutation(get, set, albumId, rowIndex => model.rateListen(gateway, spreadsheetId, rowIndex, albumId, listenIndex, rating), () => {
      set({
        listens: (get().listens ?? []).map(l =>
          l.albumId === albumId && l.index === listenIndex ? { ...l, rating } : l
        ),
      });
    });
  },

  async toggleMuted(albumId, muted) {
    const { gateway, spreadsheetId } = ctx();
    await applyMutation(get, set, albumId, rowIndex => model.setMuted(gateway, spreadsheetId, rowIndex, albumId, muted), () => {
      set({ albums: (get().albums ?? []).map(a => (a.id === albumId ? { ...a, muted } : a)) });
    });
  },

  async mergeSpotifyMetadata(albumId, metadata) {
    const { gateway, spreadsheetId } = ctx();
    await applyMutation(get, set, albumId, rowIndex => model.setSpotifyMetadata(gateway, spreadsheetId, rowIndex, albumId, metadata), () => {
      set({
        albums: (get().albums ?? []).map(a =>
          a.id === albumId
            ? {
                ...a,
                spotifyId: metadata.spotifyId,
                name: a.name || metadata.name || '',
                artist: a.artist || metadata.artist || '',
                year: a.year || metadata.year || null,
              }
            : a
        ),
      });
    });
  },

  async addAlbum(newAlbum) {
    const { gateway, spreadsheetId } = ctx();
    const rowIndex = get().rowIndex;
    const existingIds = new Set(rowIndex.keys());
    const album = await model.addAlbum(gateway, spreadsheetId, newAlbum, existingIds);
    const nextRow = rowIndex.size === 0 ? model.FIRST_DATA_ROW : Math.max(...rowIndex.values()) + 1;
    set({
      albums: [...(get().albums ?? []), album],
      rowIndex: new Map(rowIndex).set(album.id, nextRow),
    });
    return album;
  },

  async drawSample() {
    const { albums, listens, rowIndex } = get();
    if (!albums || albums.length === 0) return { drawn: null, topK: [] };

    const settings = useSamplingSettings.getState();
    const topK = drawTopK(albums, settings, 20);
    const chosen = topK[0] ?? null;
    if (!chosen) return { drawn: null, topK: [] };

    const weights = computeWeights(albums, listens ?? [], settings);
    const newPriorities = applyDraw(albums, weights, chosen.id, settings);

    // Update local state immediately; write to sheet in background.
    set({ albums: albums.map(a => ({ ...a, priority: newPriorities.get(a.id) ?? a.priority })) });
    const { gateway, spreadsheetId } = ctx();
    const lastRow = Math.max(...rowIndex.values());
    model.writePriorities(gateway, spreadsheetId, lastRow, newPriorities, rowIndex).catch(console.error);

    return { drawn: chosen, topK };
  },
}));
