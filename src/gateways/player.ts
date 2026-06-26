import {
  generateCodeVerifier,
  generateCodeChallenge,
  storeVerifier,
  retrieveAndClearVerifier,
  exchangeCodeForTokens,
  refreshAccessToken as pkceRefresh,
} from './pkce';

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SCOPE = 'user-read-private user-read-email user-modify-playback-state user-read-playback-state';
const VERIFIER_NS = 'spotify';

export class PlayerGateway {
  private static instance: PlayerGateway;
  private clientId: string | null = null;
  private redirectUri = '';
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onTokensRefreshed: ((accessToken: string, refreshToken: string | null) => void) | null = null;

  private constructor() {}

  static getInstance(): PlayerGateway {
    if (!PlayerGateway.instance) PlayerGateway.instance = new PlayerGateway();
    return PlayerGateway.instance;
  }

  setOnTokensRefreshed(cb: (accessToken: string, refreshToken: string | null) => void): void {
    this.onTokensRefreshed = cb;
  }

  initialize(clientId: string): void {
    this.clientId = clientId;
    this.redirectUri = `https://127.0.0.1:5173/spotify-callback`;
  }

  isReady(): boolean {
    return !!this.clientId;
  }

  setTokens(accessToken: string, refreshToken?: string | null): void {
    this.accessToken = accessToken;
    if (refreshToken) this.refreshToken = refreshToken;
  }

  async authorize(): Promise<void> {
    if (!this.clientId) throw new Error('Gateway not initialized.');
    const verifier = generateCodeVerifier();
    storeVerifier(VERIFIER_NS, verifier);
    const challenge = await generateCodeChallenge(verifier);
    const authUrl = new URL(AUTHORIZE_URL);
    authUrl.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: SCOPE,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      redirect_uri: this.redirectUri,
    }).toString();
    window.location.href = authUrl.toString();
  }

  async exchangeCodeForToken(
    code: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    if (!this.clientId) throw new Error('Gateway not initialized.');
    const codeVerifier = retrieveAndClearVerifier(VERIFIER_NS);
    if (!codeVerifier) throw new Error('Missing code verifier.');
    const tokens = await exchangeCodeForTokens(TOKEN_URL, {
      clientId: this.clientId,
      code,
      redirectUri: this.redirectUri,
      codeVerifier,
    });
    this.setTokens(tokens.accessToken, tokens.refreshToken);
    return tokens;
  }

  isAuthorized(): boolean {
    return this.accessToken !== null;
  }

  signout(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }

  async getProfileName(): Promise<string> {
    if (!this.accessToken) throw new Error('Gateway not authorized.');
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message ?? `Profile request failed (${response.status})`);
    return data.display_name as string;
  }

  private async doRefresh(): Promise<void> {
    if (!this.clientId || !this.refreshToken) throw new Error('Cannot refresh: missing credentials.');
    const tokens = await pkceRefresh(TOKEN_URL, { clientId: this.clientId, refreshToken: this.refreshToken });
    this.accessToken = tokens.accessToken;
    if (tokens.refreshToken) this.refreshToken = tokens.refreshToken;
    this.onTokensRefreshed?.(this.accessToken, this.refreshToken);
  }

  private async authedFetch(url: string, init?: RequestInit): Promise<Response> {
    if (!this.accessToken) throw new Error('Gateway not authorized.');
    let response = await fetch(url, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${this.accessToken}` },
    });
    if (response.status === 401 && this.refreshToken) {
      await this.doRefresh();
      response = await fetch(url, {
        ...init,
        headers: { ...init?.headers, Authorization: `Bearer ${this.accessToken}` },
      });
    }
    return response;
  }

  async searchAlbums(query: string): Promise<SpotifyAlbumResult[]> {
    const url = new URL('https://api.spotify.com/v1/search');
    url.search = new URLSearchParams({ q: query, type: 'album' }).toString();
    const response = await this.authedFetch(url.toString());
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message ?? `Search failed (${response.status})`);
    return (data.albums?.items ?? []).map((item: any) => ({
      spotifyId: item.id,
      name: item.name,
      artist: item.artists?.[0]?.name ?? '',
      year: item.release_date ? parseInt(item.release_date.slice(0, 4), 10) : null,
    }));
  }

  async getAlbumTracks(spotifyAlbumId: string): Promise<{ uri: string; name: string }[]> {
    const response = await this.authedFetch(`https://api.spotify.com/v1/albums/${spotifyAlbumId}/tracks`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message ?? `Tracklist request failed (${response.status})`);
    return (data.items ?? []).map((item: any) => ({ uri: item.uri, name: item.name }));
  }

  async getAlbumById(spotifyId: string): Promise<SpotifyAlbumResult | null> {
    const response = await this.authedFetch(`https://api.spotify.com/v1/albums/${spotifyId}`);
    if (response.status === 404) return null;
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message ?? `Album lookup failed (${response.status})`);
    return {
      spotifyId: data.id,
      name: data.name,
      artist: data.artists?.[0]?.name ?? '',
      year: data.release_date ? parseInt(data.release_date.slice(0, 4), 10) : null,
    };
  }

  async getDevices(): Promise<SpotifyDevice[]> {
    const response = await this.authedFetch('https://api.spotify.com/v1/me/player/devices');
    if (response.status === 204) return [];
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message ?? `Devices request failed (${response.status})`);
    return (data.devices ?? []) as SpotifyDevice[];
  }

  async queueTrack(trackUri: string, deviceId?: string): Promise<void> {
    const url = new URL('https://api.spotify.com/v1/me/player/queue');
    const params: Record<string, string> = { uri: trackUri };
    if (deviceId) params.device_id = deviceId;
    url.search = new URLSearchParams(params).toString();
    const response = await this.authedFetch(url.toString(), { method: 'POST' });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error?.message ?? `Queue request failed (${response.status})`);
    }
  }
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  is_restricted: boolean;
  volume_percent: number;
  supports_volume: boolean;
}

export interface SpotifyAlbumResult {
  spotifyId: string;
  name: string;
  artist: string;
  year: number | null;
}
