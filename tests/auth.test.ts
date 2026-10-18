import assert from "node:assert/strict";
import { test } from "node:test";
import { AuthSession } from "../src/auth/session";

const config = { authorizationEndpoint: "https://login.test/authorize", tokenEndpoint: "https://login.test/token",
  clientId: "public-client", redirectUri: "https://app.test/", scopes: "openid words/write" };

test("PKCE login, callback deduplication, refresh, state rejection and local sign-out", async () => {
  const originals = new Map(["sessionStorage", "window", "history", "fetch"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const storage = new Map<string, string>();
  let location = "https://app.test/";
  let assigned = "";
  const bodies: URLSearchParams[] = [];
  const define = (key: string, value: unknown) => Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  define("sessionStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  define("window", { location: { get href() { return location; }, assign: (url: URL) => assigned = String(url) } });
  define("history", { replaceState: (_a: unknown, _b: unknown, url: URL) => location = String(url) });
  define("fetch", async (_url: string, init: RequestInit) => {
    bodies.push(new URLSearchParams(String(init.body)));
    return Response.json({ access_token: "access-token", refresh_token: "refresh-token", expires_in: bodies.length === 1 ? 1 : 3600 });
  });
  try {
    const auth = new AuthSession(config);
    await auth.signIn();
    const authorize = new URL(assigned);
    assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
    assert.equal(authorize.searchParams.get("response_type"), "code");
    assert.equal(authorize.searchParams.get("client_secret"), null);
    const pending = JSON.parse(storage.get("zh-card.login")!);
    assert.equal(pending.verifier.length, 43);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pending.verifier));
    assert.equal(authorize.searchParams.get("code_challenge"), Buffer.from(digest).toString("base64url"));
    location = `https://app.test/?code=one-use-code&state=${pending.state}`;
    await Promise.all([auth.completeSignIn(), auth.completeSignIn()]);
    assert.equal(bodies.length, 1);
    assert.equal(bodies[0]!.get("code_verifier"), pending.verifier);
    assert.equal(location, "https://app.test/");
    assert.equal(auth.hasSession(), true);
    assert.deepEqual(await Promise.all([auth.getAccessToken(), auth.getAccessToken()]), ["access-token", "access-token"]);
    assert.equal(bodies.length, 2);
    assert.equal(bodies[1]!.get("grant_type"), "refresh_token");
    assert.equal(await auth.getAccessToken(), "access-token");
    assert.equal(bodies.length, 2);
    storage.set("zh-card.tokens", JSON.stringify({ accessToken: "expired", expiresAt: 0 }));
    await assert.rejects(auth.getAccessToken(), /session expired/);
    assert.equal(auth.hasSession(), true, "An expired token must not implicitly unmount the editor draft");
    auth.signOut();
    assert.equal(auth.hasSession(), false);
    await assert.rejects(auth.getAccessToken(), /Sign in/);
    const rejected = new AuthSession(config);
    await rejected.signIn();
    location = "https://app.test/?code=attacker&state=wrong";
    await assert.rejects(rejected.completeSignIn(), /verified/);
    assert.equal(bodies.length, 2);
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
