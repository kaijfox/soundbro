import { PlayerGateway, type SpotifyAlbumResult } from '../gateways/player';

// Spotify album ids are 22-character base62 strings — distinguishes a pasted
// id from a free-text name/artist/year query.
function isSpotifyId(query: string): boolean {
  return /^[A-Za-z0-9]{22}$/.test(query.trim());
}

export interface AlbumSearchQuery {
  raw?: string; // pasted Spotify id or free-text query
  name?: string;
  artist?: string;
  year?: number | null;
}

export async function searchAlbums(gateway: PlayerGateway, query: AlbumSearchQuery): Promise<SpotifyAlbumResult[]> {
  if (query.raw && isSpotifyId(query.raw)) {
    const album = await gateway.getAlbumById(query.raw.trim());
    return album ? [album] : [];
  }

  const terms = [
    query.raw,
    query.name,
    query.artist ? `artist:${query.artist}` : null,
    query.year ? `year:${query.year}` : null,
  ].filter(Boolean);
  if (terms.length === 0) return [];

  return gateway.searchAlbums(terms.join(' '));
}

// Queues every track on the album, in order. Pass deviceId to target a specific Spotify device.
export async function queueAlbum(gateway: PlayerGateway, spotifyAlbumId: string, deviceId?: string | null): Promise<void> {
  const tracks = await gateway.getAlbumTracks(spotifyAlbumId);
  for (const track of tracks) {
    await gateway.queueTrack(track.uri, deviceId ?? undefined);
  }
}
