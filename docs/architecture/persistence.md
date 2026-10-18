# Persistence

Status: implemented in source; local mocked integration tests pass. Live AWS persistence is not yet verified.

## HTTP contract

Authentication is temporarily unplugged. The application sends anonymous requests and Lambda performs no owner or JWT checks. Anyone able to reach an unauthenticated deployed endpoint can read and modify its dictionary. Bodies and successful word responses use the full WordEntry schema, not the old flat vocabulary format.

| Method/path | Request | Success |
| --- | --- | --- |
| GET /words | Optional limit (1-100, default 25) and opaque cursor | 200: `{ "items": [...], "nextCursor": "..." }`; nextCursor omitted at end |
| GET /words/{id} | Path ID | 200 WordEntry; 404 if absent |
| POST /words | Complete draft WordEntry | 201 persisted WordEntry with server root ID/timestamps |
| PUT /words/{id} | Complete WordEntry; body ID must match path; updatedAt is loaded revision | 200 saved WordEntry with preserved createdAt and new updatedAt |
| DELETE /words/{id} | If-Match header containing the loaded updatedAt string | 204 without a body |

Errors contain `{ "message": "..." }`: 400 malformed input/cursor, 404 missing GET/PUT word or unknown route, 409 conditional write conflict, 500 unexpected failure, 503 missing Lambda configuration. An existing API Gateway authorizer can still reject requests before Lambda runs; remove it from these routes for this temporary setup. A stale delete, including an already deleted word, returns 409.

POST uses attribute_not_exists(id). PUT reads consistently to preserve createdAt, then conditionally replaces the document only if it still exists and updatedAt matches the request revision. DELETE uses the same revision condition. Two writers using one revision cannot both succeed. No automatic write retries or conflict merging occur. A successful response is required before the UI closes the draft.

List uses a bounded, consistent DynamoDB Scan. Its LastEvaluatedKey is encoded as base64url JSON; the cursor validator supports the documented id-only table key. Scans have no stable sort order or snapshot guarantee across pages and are suitable for the current small single-owner dictionary. The client merges pages by ID. For larger dictionaries, design indexed query/search access patterns.

## Browser repository and UI

ApiWordRepository sends no Authorization header, validates returned words/pages, maps GET 404 to null, propagates API status/messages as ApiError, and supports bodyless 204 deletion. list(cursor?) returns WordPage instead of a bare array. delete requires both ID and revision.

App loads the first page on startup, lets the user fetch a selected entry, load additional pages, reload, create, edit, and delete with confirmation. Saving disables draft controls and duplicate submission. Failures leave the editor and its draft mounted; success stores the server response and shows confirmation. Loading/selection responses use a request counter to ignore obsolete results. Reloading the page fetches persisted data again; it does not restore the previous selected word or an unsaved draft.

On a conflict, preserve/copy any desired edits, cancel, reload, and reapply them. Browser navigation discards unsaved drafts; draft restoration remains future work.

## Configuration and parked authentication

Copy .env.example to .env.local and set VITE_API_BASE_URL to the deployed API base URL (including its stage path when applicable). Restart Vite after changes. No OAuth settings, token, login, or OWNER_SUB are required. The app loads the dictionary immediately.

src/auth/session.ts and tests/auth.test.ts are retained for later restoration, but AuthSession is not imported or instantiated by the application. Its PKCE code and isolated tests do not gate the UI or HTTP requests. ApiWordRepository no longer accepts a token provider. The Lambda uses the ordinary API Gateway v2 event type and requires only TABLE_NAME.

## Deployment

The existing Jenkins pipeline updates Lambda code only. If the API Gateway routes already require JWT or IAM authorization, set their authorization type to NONE and remove their authorizer/scopes; deploying Lambda code does not change API Gateway settings. The checked-in optional SAM template now declares no authorizer.

Configure all five routes and allow the localhost browser origin, GET/POST/PUT/DELETE/OPTIONS methods, and Content-Type/If-Match headers in API Gateway CORS. CORS does not authenticate callers. Lambda still needs TABLE_NAME and an execution role granting GetItem, Scan, PutItem, and DeleteItem on that table. These AWS execution/deployment credentials remain necessary and are separate from the browser authentication that was unplugged.

infrastructure/template.yaml is an optional SAM stack for a new unauthenticated HTTP API and Lambda around an existing table. Its parameters are TableName and AllowedOrigins. Build first, then validate/review the deployment:

```bash
npm ci
npm --prefix src/backend ci
npm --prefix src/backend run build
sam validate --lint --template-file infrastructure/template.yaml
sam deploy --guided --template-file infrastructure/template.yaml --capabilities CAPABILITY_IAM
```

Use ApiBaseUrl for VITE_API_BASE_URL. If using this new stack with Jenkins, set LAMBDA_FUNCTION to its FunctionName output; the existing pipeline targets zh-card-words. The template does not adopt existing resources. It has not been SAM-validated or deployed locally because the SAM CLI and deployment values are unavailable.

## Verification

npm test runs Node/tsx tests with an injected in-memory DynamoDB substitute and mocked OAuth/fetch endpoints. Coverage includes persistence through separate repository instances, revision conflicts, paginated listing, invalid nested records, anonymous access without authorizer claims, invalid API responses, Pinyin round trips, both Hanzi conversion directions, PKCE/state validation, duplicate callback handling, refresh, and sign-out. These are contract/integration tests; they do not establish deployed AWS behavior or browser interaction correctness.

Live acceptance still required: create a word, reload and fetch it, edit/reload, attempt a stale second-tab update/delete, delete it, and confirm GET returns 404. Verify anonymous requests reach the existing API routes and browser preflight requests succeed. See the [roadmap](../roadmap/index.md).
