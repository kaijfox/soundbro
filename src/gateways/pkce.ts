const VERIFIER_PREFIX = 'pkce_verifier_';

export function generateCodeVerifier(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  return bytes.reduce((acc, b) => acc + chars[b % chars.length], '');
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hashed = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hashed)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function storeVerifier(namespace: string, verifier: string): void {
  localStorage.setItem(VERIFIER_PREFIX + namespace, verifier);
}

export function retrieveAndClearVerifier(namespace: string): string | null {
  const key = VERIFIER_PREFIX + namespace;
  const value = localStorage.getItem(key);
  localStorage.removeItem(key);
  return value;
}

export async function exchangeCodeForTokens(
  tokenUrl: string,
  params: { clientId: string; code: string; redirectUri: string; codeVerifier: string, client_secret?: string }
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: params.clientId,
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
      ...(params.client_secret ? { client_secret: params.client_secret } : {}),
  });
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? `Token request failed (${res.status})`);
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}

export async function refreshAccessToken(
  tokenUrl: string,
  params: { clientId: string; refreshToken: string; clientSecret?: string }
): Promise<{ accessToken: string; refreshToken: string | null; expiresIn: number }> {
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: params.clientId,
      refresh_token: params.refreshToken,
      ...(params.clientSecret ? { client_secret: params.clientSecret } : {}),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? `Token refresh failed (${res.status})`);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in,
  };
}
