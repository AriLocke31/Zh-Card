# Backend and storage

## Active persistence modules

- src/repositories/WordRepository.ts: typed interface with getById(id), list(cursor?), create(word), update(word), delete(id, updatedAt). WordPage is items plus optional nextCursor.
- src/repositories/ApiWordRepository.ts: fetch implementation with an async access-token provider and Bearer headers, response validation, ApiError status/message propagation, GET 404 -> null, and DELETE 204 support. The optional injected transport supports integration tests.
- src/auth/session.ts: active AuthSession/AuthConfig authorization-code/PKCE implementation, including callback validation, session storage, refresh, and local sign-out.
- src/config.ts: reads public Vite variables, identifies missing required settings, and constructs the session and authenticated repository; API URL, OAuth endpoints, and client ID are required.
- src/validation/word.ts: isRecord, isWordEntry write guard, isStoredWordEntry read guard (permits empty senses for existing entries), and normalizeWord field-whitelisted copier/normalizer, shared by browser and backend.
- src/backend/src/handler.ts: exported createHandler(send, config) enables injected DynamoDB tests. handler is the production instance. It uses GetCommand, ScanCommand, PutCommand, DeleteCommand; normalizes writes; requires verified Cognito access-token claims and OWNER_SUB; and returns JSON responses. Private Command and Result describe its injection boundary.

[Persistence](../architecture/persistence.md) is the detailed reference for all routes, request/response shapes, revision conditions, errors, OAuth, table schema, deployment, and testing. The backend imports no frontend configuration or browser-only APIs.

## Disconnected browser LowDB prototype (src/data.ts)

Private Database is `{ words: WordEntry[] }`. Private AsyncBrowserStorage<T> wraps LocalStorage with asynchronous read/write methods. LowDB uses the flashcard-db key and an empty word list. App does not import it.

| Export | Behavior |
| --- | --- |
| initDB() | Reads storage into the database instance. |
| getWords() | Reads and returns the word array. |
| addWord(word: Omit<WordEntry, 'id'>) | Generates a Date.now string ID, appends to current memory, writes, and returns the entry without first refreshing storage. |
| summarizeMeanings(meanings) | Empty string for none; joins up to two; otherwise first meaning and remaining count. |
| downloadDB() | Downloads flashcard-backup.json using Blob/object URL/temporary anchor. |
| uploadDB(file) | FileReader JSON import; checks only words is an array before replacing storage. |

## Disconnected Node importer (src/index.ts)

Standalone top-level-await script reads slash-separated src/all_words.md lines into the private legacy Word type: numeric id, hanzi, pinyin, meaning. Populates db.json only when words is empty, then logs twenty input records. Its flat schema is incompatible with WordEntry and it is not a migration path into DynamoDB.
