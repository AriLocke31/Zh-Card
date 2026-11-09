# Word metadata and counters

Implemented in source; live AWS deployment/backfill must be performed by the operator. This adds metadata and written-form lookup routes and a separate metadata table without changing WordEntry's key schema.

## Data and invariants

UserMetadata uses a string partition key userId and a string sort key key. Both tables must be in the same AWS account and Region. One owner's summary is:

```json
{
  "userId": "a448a4b8-7001-7026-be60-4ab12223fd3a",
  "key": "SUMMARY",
  "schemaVersion": 1,
  "formIndexVersion": 1,
  "wordCount": 42,
  "wordsCreatedTotal": 42,
  "initializedAt": "2026-10-26T12:00:00.000Z",
  "updatedAt": "2026-10-26T12:00:00.000Z"
}
```

wordCount is the current word total. wordsCreatedTotal is the number present at initialization plus all successful creates afterwards; deleted words from before initialization cannot be reconstructed. initializedAt records this baseline. Future deletes reduce wordCount only. Content updates affect neither counter.

POST /words uses one TransactWriteCommand for the conditional word insertion, atomic summary increment, durable creation-request record, and all written-form reservations. DELETE /words/{id} uses one transaction for the existing revision-checked deletion, an atomic summary decrement guarded against going below zero, and removal of its written-form reservations. PUT uses a revision-checked transaction to maintain reservations without changing counters. Failed/conflicting operations cannot partially change counts. No automatic initialization from zero occurs: missing/invalid metadata blocks creates and deletes with 503 and a backfill message. Existing word reads remain available; creates, edits, deletes, and lookups require the completed form-index marker. Metadata records never appear in WordEntry scans.

Transactions follow [DynamoDB's all-or-nothing semantics](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html). Lambda execution permissions use the underlying GetItem/PutItem/UpdateItem/DeleteItem actions, as described in [AWS transaction IAM guidance](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis-iam.html).

## Idempotent creation

ApiWordRepository sends Idempotency-Key using the draft's UUID, stable across retries. Lambda also accepts the draft ID as a fallback for older callers. Keys must contain 1-128 ASCII letters, digits, underscores, or hyphens. A successful request stores CREATE#<key> under the authenticated owner in the metadata table, with a normalized-content SHA-256 fingerprint and original saved WordEntry response.

Replaying the key with matching content returns the original 201 response without another insertion or increment, including after the word is subsequently deleted. Reusing it for changed content returns 409; open the existing word to edit it. Root/sense timestamps are excluded from fingerprinting because the editor refreshes sense timestamps on each Save attempt. All other content remains part of the fingerprint. Keys are owner-scoped and records currently have no expiration. These records store an additional original-word snapshot per creation; retention/compaction is future work and must preserve the deduplication contract.

Concurrent identical creates replay the winner's response. Transaction condition failures return 409; recognized transaction conflicts/throttling return 503 so callers can retry the same draft. Unexpected service errors still return 500. Blindly starting a fresh draft after an ambiguous timeout can intentionally create a second word; reuse the original draft to retry.

## Endpoint and frontend

GET /metadata requires the same Cognito authorizer/access-token/OWNER_SUB checks as word routes. It performs a consistent summary read and returns only wordCount, wordsCreatedTotal, initializedAt, updatedAt. Missing initialization returns 503 rather than reporting an invented zero.

UserMetadataProvider mounts after sign-in, loads this endpoint, and exposes metadata plus refreshMetadata through useUserMetadata(). Successful word creation/deletion refreshes the summary. The words page uses the live wordCount for its page selector and displays the total below it; selecting an undiscovered page resolves the necessary opaque cursor chain. Metadata fetch failures clear cached totals and show an independent retry warning without disguising a successful save as a failed write. Sign-out unmounts the provider.

The Study queue is stored separately as one owner-scoped `STUDY_ORDER` metadata item containing the ordered word IDs; each word's sort index is its zero-based position. A missing order starts with words sorted by `createdAt` descending. Study actions only reorder the in-memory queue; `POST /study/sync` conditionally replaces the stored order when the user clicks Sync. The session order survives route changes in memory but is lost on reload/sign-out if it has not been synced. New words are placed at the front by creation date, and deleted words are filtered when the queue loads. The sync payload is bounded to keep the metadata item below DynamoDB's 400 KB item limit.

## Deploy with your existing API and Lambda

1. Create a separate on-demand table named UserMetadata, with userId (String) as partition key and key (String) as sort key. Either use the DynamoDB console or deploy only infrastructure/metadata-table.yaml. Do not deploy the entire optional SAM stack just to add this table to your existing API.
2. Keep TABLE_NAME and OWNER_SUB on Lambda; add METADATA_TABLE_NAME=UserMetadata (or your chosen table name).
3. Keep current WordEntry table permissions. Add the following statement to Lambda's execution role, using the actual metadata table ARN:

```json
{
  "Effect": "Allow",
  "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:ConditionCheckItem"],
  "Resource": "arn:aws:dynamodb:us-east-1:151559871413:table/UserMetadata"
}
```

4. Add GET /metadata, GET /words/lookup, GET /study/order, and POST /study/sync to the existing API Gateway API, integrated with the same Lambda using payload 2.0 and ZhCardCognito JWT authorization. Add Idempotency-Key to allowed CORS headers, retaining Authorization, Content-Type, and If-Match. Deploy the stage if necessary.
5. Pause ALL word writers, wait for in-flight requests to finish, and run the backfill below. Setting the Lambda's reserved concurrency to zero can stop new API invocations while the operator accesses DynamoDB directly; also pause any other writers/scripts. Do not resume old create/delete code after initialization: it does not maintain counters.
6. Deploy the new Lambda through Jenkins and updated frontend while writers remain paused, then restore service. The new Lambda refuses create/delete until the summary exists, so no silent zero-based counters are created if deployment order changes.
7. Verify GET /metadata, create (+1 to both), edit (no change), delete (-1 to current only), and retry a creation (no extra increment). Verify stale deletion leaves counts untouched.

The main infrastructure/template.yaml also provisions a retained metadata table, configures the Lambda environment/permissions, declares GET /metadata, GET /words/lookup, GET /study/order, POST /study/sync, and permits the idempotency header for users deploying a new complete stack. Neither template nor any AWS resources were deployed during local implementation.

## Backfill existing words once

Use AWS credentials for an operator with Scan on WordEntry and GetItem/PutItem on the metadata table. These are script/operator credentials, not browser credentials. The table must already exist. From the repo root in PowerShell:

```powershell
$env:AWS_REGION = 'us-east-1'
$env:TABLE_NAME = 'WordEntry'
$env:METADATA_TABLE_NAME = 'UserMetadata'
$env:OWNER_SUB = 'a448a4b8-7001-7026-be60-4ab12223fd3a'
npm --prefix src/backend ci
# Preview only; no data is written.
npm --prefix src/backend run metadata:backfill
# Only after all writers are paused and in-flight writes have finished:
npm --prefix src/backend run metadata:backfill -- --apply --writes-paused
```

The script scans every page with a projection of id/forms and ConsistentRead, counts words, and detects normalized written-form collisions before any writes. It then writes restartable FORM reservations and publishes SUMMARY with formIndexVersion=1 last. Partial migrations remain blocked from application mutations. It refuses an existing summary unless --upgrade-form-index is explicitly supplied and the existing summary has no form-index marker. That upgrade preserves counts and baseline timestamps and verifies wordCount against the table. A scan is not a transactionally consistent snapshot across pages; --writes-paused is an operator acknowledgement, not an automated lock. Running the preview against a changing table gives an estimate; the applied initialization requires the write pause. On an empty table, it initializes both counts to zero. If complete initialization succeeded, rerunning intentionally fails. Interrupted mapping writes can be resumed while all writers remain paused. Future reconciliation needs a separately designed operation that preserves lifetime totals and request records.

## Tests and remaining scope

Local injected-DynamoDB tests exercise atomic counter changes, lost-response and concurrent creation retries, stale deletes, transaction rollback, uninitialized metadata, authorization, response validation, and paginated backfill safety. No live AWS calls were made by the tests.

Daily activity records (e.g. DAY#2026-10-26), user timezone/preferences, actual-word-by-day indexes, and due-card scheduling queries are not implemented. The metadata key layout reserves space for these records without packing everything into one SUMMARY document. A summary counter is appropriate for the current small single-owner app; high write contention may require a different counter design.


## Written-form identity and duplicate detection

One normalized written form belongs to exactly one WordEntry per authenticated owner. Matching trims surrounding whitespace and applies Unicode NFC; it preserves internal whitespace, case, script, and punctuation. Simplified/traditional variants only resolve to the same word when both are stored as its forms. The FORM key is FORM# plus SHA-256 of the normalized text; the metadata item contains userId, key, text, and wordId. Duplicate normalized forms within one entry produce one reservation.

GET /words/lookup?form=<URL-encoded-Hanzi> consistently reads the owner-scoped mapping and full word; it returns 200 WordEntry or 404 for no match, and 503 if the index is not ready. The static /words/lookup route must be added explicitly, with the existing Lambda integration and Cognito authorizer, alongside /words/{id}.

The Create editor checks all nonempty forms after a 350ms typing pause and after IME composition completes. A match immediately replaces all draft content with the saved word, displays an alert, and makes Save call PUT rather than POST. This replacement is intentional: no draft merge or confirmation is performed. The old draft ID, timestamps, forms, readings, senses, components, and tags are discarded in favor of the existing entry. Stale/outdated lookup responses are ignored. Save is unavailable during the check or a lookup failure, which has a retry control. A final lookup before create and transactional reservations guard against a late/concurrent duplicate.

Conflicting writes return 409 with code WRITTEN_FORM_EXISTS and a complete existingWord payload. The repository validates it before the editor replaces its draft; no counter increment occurs for a rejected create. Updates also reject assigning another entry's form. Reservations and the word revision change in one transaction; deletes only release reservations owned by that word. The implementation rejects operations that exceed DynamoDB's 100-action transaction limit (97 distinct forms for a fresh create; updates account for old and new forms). This is a single-owner app currently, with owner-scoped keys ready for future ownership work.

For a fresh metadata deployment, run the regular backfill above: it now initializes both counts and mappings. If the earlier counters-only version was already initialized, keep all writers paused and run:

```powershell
npm --prefix src/backend run metadata:backfill -- --upgrade-form-index
npm --prefix src/backend run metadata:backfill -- --upgrade-form-index --apply --writes-paused
```

The preview and applied run report collisions with their form text and word IDs; resolve these before applying. The script will not silently choose a winner or reset lifetime counts. Keep writers paused until deploying the index-aware backend, and do not run older code that writes words without maintaining FORM records. If interrupted before publishing SUMMARY, rerun the same migration with writers still paused.
