import {
  generateCodeVerifier,
  generateCodeChallenge,
  storeVerifier,
  retrieveAndClearVerifier,
  exchangeCodeForTokens,
  refreshAccessToken as pkceRefresh,
} from './pkce';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SHEETS_DISCOVERY = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const VERIFIER_NS = 'google';
const REDIRECT_URI = 'https://127.0.0.1:5173/google-callback';

export class DocumentGateway {
  private static instance: DocumentGateway;
  private clientId: string | null = null;
  private clientSecret: string | null = null;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private gapiInited = false;
  private onTokensRefreshed: ((accessToken: string, refreshToken: string | null) => void) | null = null;

  private constructor() {}

  static getInstance(): DocumentGateway {
    if (!DocumentGateway.instance) DocumentGateway.instance = new DocumentGateway();
    return DocumentGateway.instance;
  }

  setOnTokensRefreshed(cb: (accessToken: string, refreshToken: string | null) => void): void {
    this.onTokensRefreshed = cb;
  }

  async initialize(clientId: string, apiKey?: string, clientSecret?: string): Promise<void> {
    this.clientId = clientId;
    if (clientSecret) this.clientSecret = clientSecret;

    await new Promise<void>((resolve, reject) => {
      const gapiLoad = gapi.load as (name: string, cfg: { callback: () => void; onerror: (e: unknown) => void }) => void;
      gapiLoad('client', {
        callback: () => {
          gapi.client
            .init({ apiKey: apiKey || undefined, discoveryDocs: [SHEETS_DISCOVERY] })
            .then(() => {
              this.gapiInited = true;
              // Restore persisted token into gapi if one was set before init completed.
              if (this.accessToken) gapi.client.setToken({ access_token: this.accessToken });
              resolve();
            })
            .catch(reject);
        },
        onerror: reject,
      });
    });
  }

  setTokens(accessToken: string, refreshToken: string | null): void {
    this.accessToken = accessToken;
    if (refreshToken !== null) this.refreshToken = refreshToken;
    if (this.gapiInited) gapi.client.setToken({ access_token: accessToken });
  }

  isReady(): boolean {
    return this.gapiInited;
  }

  isAuthorized(): boolean {
    return this.accessToken !== null;
  }

  async authorize(loginHint?: string): Promise<void> {
    if (!this.clientId) throw new Error('Gateway not initialized — save Client ID first.');
    const verifier = generateCodeVerifier();
    storeVerifier(VERIFIER_NS, verifier);
    const challenge = await generateCodeChallenge(verifier);
    const params: Record<string, string> = {
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: REDIRECT_URI,
      scope: SCOPE,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      access_type: 'offline',
      prompt: 'consent', // ensures a refresh token is returned
    };
    if (loginHint) params.login_hint = loginHint;
    const url = new URL(AUTHORIZE_URL);
    url.search = new URLSearchParams(params).toString();
    window.location.href = url.toString();
  }

  async exchangeCodeForToken(
    code: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    if (!this.clientId) throw new Error('Gateway not initialized.');
    const codeVerifier = retrieveAndClearVerifier(VERIFIER_NS);
    if (!codeVerifier) throw new Error('Missing PKCE code verifier.');
    const tokens = await exchangeCodeForTokens(TOKEN_URL, {
      clientId: this.clientId,
      code,
      redirectUri: REDIRECT_URI,
      codeVerifier,
      client_secret: this.clientSecret ?? undefined,
    });
    this.setTokens(tokens.accessToken, tokens.refreshToken);
    return tokens;
  }

  private async doRefresh(): Promise<void> {
    if (!this.clientId || !this.refreshToken) throw new Error('Cannot refresh: missing credentials.');
    const tokens = await pkceRefresh(TOKEN_URL, { clientId: this.clientId, refreshToken: this.refreshToken, clientSecret: this.clientSecret ?? undefined });
    this.setTokens(tokens.accessToken, tokens.refreshToken);
    this.onTokensRefreshed?.(tokens.accessToken, tokens.refreshToken);
  }

  // Wraps any gapi Sheets call: checks for 401 in the response and retries after refresh.
  private async gapiCall<T extends { status: number; result: any }>(fn: () => Promise<T>): Promise<T> {
    let response = await fn();
    if (response.status === 401 && this.refreshToken) {
      await this.doRefresh();
      response = await fn();
    }
    if (response.result?.error) {
      throw new Error(response.result.error.message ?? `Sheets API error ${response.status}`);
    }
    return response;
  }

  signout(): void {
    this.accessToken = null;
    this.refreshToken = null;
    if (this.gapiInited) gapi.client.setToken(null);
  }

  async getSheetValues(spreadsheetId: string, range: string): Promise<string[][]> {
    const response = await this.gapiCall(() =>
      (gapi.client.sheets.spreadsheets.values.get as any)({ spreadsheetId, range })
    );
    return (response.result?.values ?? []) as string[][];
  }

  async setSheetValues(spreadsheetId: string, range: string, values: string[][]): Promise<void> {
    await this.gapiCall(() =>
      (gapi.client.sheets.spreadsheets.values.update as any)({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values },
      })
    );
  }

  async appendSheetValues(spreadsheetId: string, range: string, values: string[][]): Promise<void> {
    await this.gapiCall(() =>
      (gapi.client.sheets.spreadsheets.values.append as any)({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values },
      })
    );
  }

  async clearSheetValues(spreadsheetId: string, range: string): Promise<void> {
    await this.gapiCall(() =>
      (gapi.client.sheets.spreadsheets.values.clear as any)({ spreadsheetId, range })
    );
  }
}
