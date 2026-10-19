export interface AuthConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  redirectUri: string;
  scopes: string;
}
interface Tokens { accessToken: string; refreshToken?: string; expiresAt: number }
const TOKEN_KEY = "zh-card.tokens";
const LOGIN_KEY = "zh-card.login";
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** OAuth authorization-code flow with PKCE; no client secret is used. */
export class AuthSession {
  private completion: Promise<void> | undefined;
  private refresh: Promise<string> | undefined;
  constructor(private config: AuthConfig) {}

  private read(): Tokens | null {
    try { return JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? "null"); } catch { return null; }
  }
  hasSession() { return Boolean(this.read()); }
  signOut() { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(LOGIN_KEY); }

  async signIn() {
    const verifier = encode(crypto.getRandomValues(new Uint8Array(32)));
    const state = encode(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = encode(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    sessionStorage.setItem(LOGIN_KEY, JSON.stringify({ verifier, state, startedAt: Date.now() }));
    const url = new URL(this.config.authorizationEndpoint);
    url.search = new URLSearchParams({ response_type: "code", client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri, scope: this.config.scopes, state,
      code_challenge_method: "S256", code_challenge: challenge }).toString();
    window.location.assign(url);
  }

  completeSignIn(): Promise<void> {
    // React StrictMode can invoke the startup effect twice. Exchange each code once.
    return this.completion ??= this.complete();
  }
  private async complete() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("code") && !url.searchParams.has("error")) return;
    const stored = sessionStorage.getItem(LOGIN_KEY);
    sessionStorage.removeItem(LOGIN_KEY);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");
    for (const key of ["code", "state", "error", "error_description"]) url.searchParams.delete(key);
    history.replaceState(null, "", url);
    const pending = stored ? JSON.parse(stored) : null;
    if (!pending || pending.state !== state || Date.now() - pending.startedAt > 600_000) throw new Error("Login expired or could not be verified. Sign in again.");
    if (oauthError || !code) throw new Error("Sign-in was not completed. Please try again.");
    await this.exchange({ grant_type: "authorization_code", code, redirect_uri: this.config.redirectUri, code_verifier: pending.verifier });
  }

  private async exchange(parameters: Record<string, string>, previousRefresh?: string): Promise<string> {
    const response = await fetch(this.config.tokenEndpoint, { method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...parameters, client_id: this.config.clientId }) });
    const result = await response.json();
    if (!response.ok || typeof result.access_token !== "string" || typeof result.expires_in !== "number" || result.expires_in <= 0) {
      throw new Error("Your session could not be renewed. Sign out and sign in again. Your draft has not been saved.");
    }
    const refreshToken = result.refresh_token ?? previousRefresh;
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ accessToken: result.access_token,
      expiresAt: Date.now() + result.expires_in * 1000, ...(refreshToken ? { refreshToken } : {}) }));
    return result.access_token;
  }

  async getAccessToken(): Promise<string> {
    const tokens = this.read();
    if (!tokens) throw new Error("Sign in to access your dictionary.");
    if (tokens.expiresAt > Date.now() + 30_000) return tokens.accessToken;
    if (!tokens.refreshToken) throw new Error("Your session expired. Sign out and sign in again. Your draft has not been saved.");
    if (!this.refresh) this.refresh = this.exchange({ grant_type: "refresh_token", refresh_token: tokens.refreshToken }, tokens.refreshToken)
      .finally(() => { this.refresh = undefined; });
    return this.refresh;
  }
}
