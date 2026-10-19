import { AuthSession } from "./auth/session";
import { ApiWordRepository } from "./repositories/ApiWordRepository";

const env = import.meta.env;
export const configurationError = ["VITE_API_BASE_URL", "VITE_OAUTH_AUTHORIZATION_ENDPOINT", "VITE_OAUTH_TOKEN_ENDPOINT", "VITE_OAUTH_CLIENT_ID"]
  .filter(key => !env[key]).join(", ");
export const session = new AuthSession({
  authorizationEndpoint: env.VITE_OAUTH_AUTHORIZATION_ENDPOINT ?? "",
  tokenEndpoint: env.VITE_OAUTH_TOKEN_ENDPOINT ?? "",
  clientId: env.VITE_OAUTH_CLIENT_ID ?? "",
  redirectUri: env.VITE_OAUTH_REDIRECT_URI || `${window.location.origin}/`,
  scopes: env.VITE_OAUTH_SCOPES || "openid",
});
export const repository = new ApiWordRepository(env.VITE_API_BASE_URL ?? "", () => session.getAccessToken());
