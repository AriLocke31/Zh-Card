# Roadmap and implementation status

Updated 2026-10-19. Checked items describe implemented source or local checks, not proof of production deployment.

## Implemented

- [x] React/Material UI dictionary detail and editor with forms, readings, senses, tags, and preserved components.
- [x] Pinyin canonical numbered phrase round trips, explicit neutral tones, and corrected tone labels.
- [x] Simplified/traditional OpenCC conversion in both directions.
- [x] Shared nested WordEntry validation and field-whitelisted normalization.
- [x] JWT-protected, owner-only Lambda CRUD routes, JSON responses, paginated listing, and conditional update/delete revision checks.
- [x] Typed HTTP repository, response validation, error propagation, and GET-not-found handling.
- [x] Cognito login/PKCE, refresh, authenticated repository headers, access-token/owner enforcement, and SAM JWT authorizer restored.
- [x] Words-first navigation with /words grid, /words/:id details, and /words/new editor. WordThumb shows preferred Hanzi only; cursor-based Next/Previous and return-to-page navigation use GET /words.
- [x] API-backed loading/saving/error/success states and delete confirmation.
- [x] Draft retention on failed saves; controls disabled during submission; server ID/timestamps used after success.
- [x] Optional SAM API/Lambda template with existing table/provider parameters, scoped IAM, JWT authorization, and CORS.
- [x] Automated mocked persistence/auth/schema/normalization tests; frontend and Lambda builds and typechecks pass locally.
- [x] Jenkins pipeline runs tests/frontend build before packaging/deploying the backend.
- [x] Technical references and setup instructions updated.

## Rollout and live verification still required

- [ ] Supply real API URL configuration in .env.local and frontend hosting build settings.
- [ ] Confirm the existing DynamoDB table has string partition key id and no sort key; inspect legacy records for compatibility.
- [ ] Confirm the existing public Cognito client supports authorization-code flow and openid, and register localhost:5173/ and localhost:5174/ callback URLs.
- [ ] Configure all word and Study API routes, ZhCardCognito JWT authorization with openid scope, CORS origins/headers, Lambda TABLE_NAME/OWNER_SUB, and table IAM permissions; or validate/review/deploy the optional SAM stack.
- [ ] Run SAM validation/lint with the SAM CLI; it was unavailable locally.
- [ ] Deploy the changed Lambda and frontend; reconcile Jenkins target if creating the optional stack.
- [ ] Verify sign-in -> create -> reload -> edit -> reload -> delete -> GET 404 against DynamoDB.
- [ ] Verify anonymous/ID-token/wrong-owner rejection, token refresh, CORS preflight, and stale second-tab write/delete behavior against deployed services.
- [ ] Run the updated Jenkins pipeline in CI; only its constituent tests/builds were run locally.

## Product and reliability work missing

- [ ] Browser UI automation for loading, keyboard editing, failed-save draft retention, deletion, and authentication redirects.
- [ ] Draft recovery across page reload/login/sign-out; unsaved-change navigation warning.
- [ ] Conflict comparison/merge UI instead of manual cancel/reload/reapply.
- [ ] Provider logout/token revocation and account/session management (current sign-out is local only).
- [ ] Schema versioning, migration tooling, and import of legacy flat vocabulary/LowDB data.
- [ ] Indexed search/sort and scalable pagination; current bounded Scan has no stable snapshot/order.
- [ ] Full Jyutping syntax/tone validation, duplicate vocabulary policy, component editing and linked-entry resolution.
- [ ] Flashcard generation, deck management/filtering, review scheduling, and example-sentence workflows.
- [ ] Multi-user ownership/schema design; current endpoints are limited to one configured owner subject.
- [ ] Request timeouts/cancellation, retry policy, payload-size handling, telemetry, alarms, backups, and documented rollback.
- [ ] Browser interaction tests for cursor-grid pagination, return-to-page navigation, and direct detail links; configure SPA fallback on production hosting.
- [ ] Frontend bundle splitting; OpenCC contributes to the current large-chunk build warning.
- [ ] Retire prototype code/data after reviewing the [unused-file audit](../codebase/unused-files.md).

Roles Anywhere/Jenkins AWS authentication was previously reported working; it was not reverified against AWS during this implementation. [Persistence details and acceptance steps](../architecture/persistence.md) describe the implementation and its deployment boundaries.

- [x] Create-page Word/Article/Sentence selector, with WordEditor as default and draft preservation across selections.
- [ ] Implement ArticleEditor and SentenceEditor and their persistence; current selections show placeholders.

- [x] Local JSON article stubs, paginated ArticlesMenu at /articles, and Article detail routes with independently scrolling boxed sections.
- [ ] Article authoring and persistence remain unimplemented; the Create Article option still shows its editor placeholder.


## Metadata (2026-10-26)

- [x] Separate per-owner summary table design; authenticated GET /metadata with current/lifetime creation counts and baseline timestamps.
- [x] Transactional creation/deletion counters and persistent idempotent creation retries; updates leave counts unchanged.
- [x] Startup metadata provider, refresh after successful mutations, and independent metadata failure/retry state.
- [x] Paused-write initialization script with dry-run default and protection against overwriting a summary.
- [x] Complete-stack and metadata-table-only templates, IAM/CORS/route setup, deployment sequence, and regression tests.
- [ ] Create/configure the metadata table, route, IAM, and Lambda environment in AWS; run the backfill with all writers paused and deploy.
- [ ] Live verification of counts, retries, concurrent writes, and deployment rollout.
- [ ] Daily creation statistics with a defined timezone; indexes for actual words created by day.
- [ ] Due-card records/indexes and review counts; user settings/profile records.
- [ ] Idempotency-ledger retention, administrative reconciliation, and scaled counter contention strategy.


## Written-form identity (2026-10-26)

- [x] One normalized written form per word entry per owner, maintained through transactional create/update/delete reservations.
- [x] Authenticated exact lookup route; Create automatically replaces matching drafts with existing data and saves as an update.
- [x] Debounced IME-aware checks, stale-result rejection, pre-save checks, and concurrent-conflict recovery.
- [x] Backfill collision detection, restartable mapping writes, and explicit counters-preserving form-index upgrade.
- [ ] Configure the current API routes including Study order/sync and metadata permissions, backfill the form index with writers paused, deploy, and verify real-browser flows.
