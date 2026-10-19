# Persistence

Status: implemented in source; local mocked integration tests pass. Live AWS persistence is not yet verified.

## HTTP contract

JWT authentication is enabled. The browser sends a Cognito access token in Authorization: Bearer. API Gateway verifies the token; Lambda requires authorizer claims with token_use=access and sub matching OWNER_SUB before any DynamoDB operation. Bodies and successful word responses use the full WordEntry schema, not the old flat vocabulary format.

| Method/path | Request | Success |
| --- | --- | --- |
| GET /words | Optional limit (1-100, default 25) and opaque cursor | 200: `{ "items": [...], "nextCursor": "..." }`; nextCursor omitted at end |
| GET /words/{id} | Path ID | 200 WordEntry; 404 if absent |
| POST /words | Complete draft WordEntry | 201 persisted WordEntry with server root ID/timestamps |
| PUT /words/{id} | Complete WordEntry; body ID must match path; updatedAt is loaded revision | 200 saved WordEntry with preserved createdAt and new updatedAt |
| DELETE /words/{id} | If-Match header containing the loaded updatedAt string | 204 without a body |

Errors contain `{ "message": "..." }`: 400 malformed input/cursor, 401 missing/invalid access-token claims, 403 wrong owner, 404 missing GET/PUT word or unknown route, 409 conditional write conflict, 500 unexpected failure, 503 missing Lambda configuration. API Gateway rejects invalid/expired JWTs before Lambda runs. Lambda trusts verified API Gateway claims, not a raw Authorization header; do not expose an alternative public invocation path that fabricates authorizer claims. A stale delete, including an already deleted word, returns 409.

POST uses attribute_not_exists(id). PUT reads consistently to preserve createdAt, then conditionally replaces the document only if it still exists and updatedAt matches the request revision. DELETE uses the same revision condition. Two writers using one revision cannot both succeed. No automatic write retries or conflict merging occur. A successful response is required before the UI closes the draft.

List uses a bounded, consistent DynamoDB Scan. Its LastEvaluatedKey is encoded as base64url JSON; the cursor validator supports the documented id-only table key. Scans have no stable sort order or snapshot guarantee across pages and are suitable for the current small single-owner dictionary. The client merges pages by ID. For larger dictionaries, design indexed query/search access patterns.

## Browser repository and UI

ApiWordRepository obtains an access token from AuthSession and sends the Authorization header, validates returned words/pages, maps GET 404 to null, propagates API status/messages as ApiError, and supports bodyless 204 deletion. list(cursor?) returns WordPage instead of a bare array. delete requires both ID and revision.

App completes the login callback and loads the first page only when a session exists, lets the user fetch a selected entry, load additional pages, reload, create, edit, and delete with confirmation. Saving disables draft controls and duplicate submission. Failures leave the editor and its draft mounted; success stores the server response and shows confirmation. Loading/selection responses use a request counter to ignore obsolete results. Reloading the page fetches persisted data again; it does not restore the previous selected word or an unsaved draft.

On a conflict, preserve/copy any desired edits, cancel, reload, and reapply them. Failed saves, including token-refresh failures, leave the draft mounted. Sign-out and browser navigation discard unsaved drafts; draft restoration remains future work.

## Cognito login and configuration

AuthSession implements authorization code with S256 PKCE, random state/verifier, a ten-minute login-state lifetime, callback URL cleanup, and deduplicated code exchange under React StrictMode. Tokens are tab-scoped in sessionStorage. Requests refresh tokens within thirty seconds of expiry, with concurrent refreshes sharing one exchange. Sign-out clears the local session; identity-provider logout and token revocation are still future work. No client secret belongs in a browser app.

The existing Cognito configuration was provided by the user and verified against the pool's public discovery document:

| Setting | Value |
| --- | --- |
| API Gateway API | zfec18owue (us-east-1) |
| Existing authorizer | ZhCardCognito, ID wpmzqk |
| Issuer | https://cognito-idp.us-east-1.amazonaws.com/us-east-1_gCGZV3F39 |
| Audience / client ID | dtirh82840p4fm4q0rc88n5t7 |
| Authorization endpoint | https://us-east-1gcgzv3f39.auth.us-east-1.amazoncognito.com/oauth2/authorize |
| Token endpoint | https://us-east-1gcgzv3f39.auth.us-east-1.amazoncognito.com/oauth2/token |
| Lambda OWNER_SUB | a448a4b8-7001-7026-be60-4ab12223fd3a |

The issuer/JWKS URL verifies JWTs; the hosted-login endpoints perform sign-in. The frontend uses the public client ID and endpoints in .env.local. These have been filled in locally while preserving VITE_API_BASE_URL. .env.example documents the same public settings. The default requested scope is openid, which the SAM template also requires on routes. If the existing routes require custom scopes, request those through VITE_OAUTH_SCOPES and enable them on the Cognito client.

VITE_OAUTH_REDIRECT_URI defaults to the actual browser origin plus `/`. Register both http://localhost:5173/ and http://localhost:5174/ in Cognito's allowed callback URLs (or pin one registered URL explicitly). Confirm this client permits authorization-code flow and is a public client without a secret. Restart Vite after configuration changes.

AWS documents [Cognito PKCE and token exchange](https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html) and [Gateway JWT validation and scope checks](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html). Login behavior and callback registration cannot be confirmed from the screenshot or public discovery metadata alone.

## Deployment

The existing Jenkins pipeline updates Lambda code only. Attach the existing ZhCardCognito authorizer to GET /words, POST /words, GET /words/{id}, PUT /words/{id}, and DELETE /words/{id}; use JWT authorization and require the openid scope (or a configured API scope). Deploy the $default stage if auto-deploy is disabled. Deploying Lambda code alone does not modify Gateway settings. The SAM template declares equivalent JWT protection for a new stack.

Configure all five routes and allow both localhost browser origins (5173 and 5174), GET/POST/PUT/DELETE/OPTIONS methods, and Authorization/Content-Type/If-Match headers in API Gateway CORS. CORS does not authenticate callers. Lambda needs TABLE_NAME, OWNER_SUB set to the value above, and an execution role granting GetItem, Scan, PutItem, and DeleteItem on that table. AWS execution/deployment credentials are separate from browser login. No local AWS CLI credentials were available, so these deployed settings were not inspected or modified.

infrastructure/template.yaml is an optional SAM stack for a new JWT-protected HTTP API and Lambda around an existing table. Its parameters are TableName, AllowedOrigins, OwnerSub, JwtIssuer, and ClientId; owner/issuer/client defaults reflect the supplied existing configuration. Build first, then validate/review the deployment:

```bash
npm ci
npm --prefix src/backend ci
npm --prefix src/backend run build
sam validate --lint --template-file infrastructure/template.yaml
sam deploy --guided --template-file infrastructure/template.yaml --capabilities CAPABILITY_IAM
```

Use ApiBaseUrl for VITE_API_BASE_URL. If using this new stack with Jenkins, set LAMBDA_FUNCTION to its FunctionName output; the existing pipeline targets zh-card-words. The template does not adopt existing resources. It has not been SAM-validated or deployed locally because the SAM CLI and deployment values are unavailable.

## Verification

npm test runs Node/tsx tests with an injected in-memory DynamoDB substitute and mocked OAuth/fetch endpoints. Coverage includes persistence through separate repository instances, revision conflicts, paginated listing, invalid nested records, JWT header transmission, rejection of missing claims/ID tokens/wrong owners on all five routes, invalid API responses, Pinyin round trips, both Hanzi conversion directions, PKCE/state validation, duplicate callback handling, refresh, and sign-out. These are contract/integration tests; they do not establish deployed AWS behavior or browser interaction correctness.

Live acceptance still required: sign in, create a word, reload and fetch it, edit/reload, attempt a stale second-tab update/delete, delete it, and confirm GET returns 404. Verify anonymous and wrong-owner requests are denied, token refresh works, and browser preflight requests succeed without login. See the [roadmap](../roadmap/index.md).
