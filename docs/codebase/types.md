# Type reference

Source: `src/types.ts`. All properties below are required unless marked `?`. These are compile-time contracts, not runtime validators. IDs and timestamps are strings; UUID syntax and ISO date syntax are not enforced by these types.

## Dictionary types

| Type | Fields and meaning |
| --- | --- |
| `UUID` | Alias for `string`, used for entity and nested-record identifiers. The fixture also uses readable IDs such as `word-001`. |
| `WordEntry` | `id: UUID`; `forms: WrittenForm[]`; `readings: Reading[]`; `senses: Sense[]`; `components: WordComponent[]`; `tags: string[]`; `createdAt: string`; `updatedAt: string`. Root dictionary aggregate displayed and edited by the app. |
| `WrittenForm` | `id: UUID`; `text: string`; `script: "simplified" \| "traditional" \| "both" \| "variant"`; `isPreferred: boolean`. Written representation of the entry. |
| `Reading` | `id: UUID`; `variety: "cmn" \| "yue"`; `system: "pinyin" \| "jyutping"`; `romanization: string`; `display?: string`; `senseIds: UUID[]`; `isStandard: boolean`; `tags: string[]`. The type does not enforce variety/system pairings; the editor chooses the matching system when variety changes. |
| `Sense` | `id: UUID`; `definition: string`; `language: string`; `partOfSpeech?: PartOfSpeech \| undefined`; `tags: SenseTag[]`; `readingIds: UUID[]`; `notes?: string`; `createdAt: string`; `updatedAt: string`. A meaning and its associated readings. |
| `SenseTag` | `category: "register" \| "region" \| "period" \| "domain" \| "usage" \| "custom"`; `value: string`. Structured usage metadata, distinct from word-level string tags. |
| `WordComponent` | `id: UUID`; `text: string`; `type: "character" \| "morpheme" \| "semantic" \| "phonetic" \| "radical" \| "graphical"`; `position?: number`; `entryId?: UUID`; `notes?: string`. Structural part of a word, optionally linked to another entry. Displayed by WordDetail and preserved, but not edited, by WordEditor. |
| `PartOfSpeech` | `"noun" \| "verb" \| "adjective" \| "adverb" \| "pronoun" \| "classifier" \| "particle" \| "conjunction" \| "preposition" \| "interjection" \| "other"`. Values offered by the editor. |

`Sense.readingIds` is the editor's editable source of truth. On save, it rebuilds `Reading.senseIds`; deleting a reading or sense removes references from the opposite collection. These invariants are editor behavior, not guarantees made by the interfaces.

## Defined for future features

These interfaces have no consumers in the current application; retain them if the planned features remain in scope.

| Type | Fields and meaning |
| --- | --- |
| `Flashcard` | `id: UUID`; `wordId: string`; `senseIds: string[]`; `readingIds: string[]`; `cardType: "recognition" \| "production" \| "listening" \| "writing"`; `deckIds: string[]`; `createdAt: string`. A reviewable selection of a word's readings and senses. |
| `ReviewState` | `cardId: string`; `dueAt: string`; `lastReviewedAt?: string`; `stability?: number`; `difficulty?: number`; `reviewCount: number`; `lapseCount: number`. Scheduling data; there is no scheduler implementation. |
| `ExampleSentence` | `id: UUID`; `hanzi: string`; `pinyin?: string`; `translation?: string`; `notes?: string`. Currently not attached to WordEntry or rendered. |

## Types outside the domain module

| Declaration | Location and contract |
| --- | --- |
| `WordThumbProps`, `WordsPageProps`, `WordPageProps` | Thumbnail and routed-page contracts; see [components](components.md). Routes replace the former App EditorMode state. |
| `WordDetailsProps`, `WordEditorProps`, `PinyinInputProps`, `SenseTagInputProps` | Private component contracts, documented in [components](components.md) and [Word Editor](word-editor.md). The detail interface is named `WordDetailsProps` although the component is singular. |
| `HanziScript` | `src/utils/hanziConversion.ts`: `"simplified" \| "traditional"`. Narrower than WrittenForm.script. |
| `ToneOption` | `src/utils/pinyin.ts`: `canonical: string`, `display: string`, `tone: number`, `label: string`. Canonical is one numbered syllable; generated tones are 1-5, although the type permits any number. |
| `ParsedPinyin` | `src/utils/pinyin.ts`: `canonical: string`, `display: string`, `editingText: string`. Canonical contains joined numbered syllables, display contains tone-marked syllables, and editingText retains explicit neutral-tone numbers. See [utilities](utilities.md). |
| `WordRepository` | `src/repositories/WordRepository.ts`: asynchronous persistence contract; see [storage](storage.md). |
| `Database` | `src/data.ts`: private `{ words: WordEntry[] }` LowDB shape, unused by App. |
| `AsyncBrowserStorage<T>` | `src/data.ts`: private generic adapter class around LowDB LocalStorage with async `read(): Promise<T \| null>` and `write(data: T): Promise<void>`; constructor takes a storage key. |
| `Word` | `src/index.ts`: private legacy `{ id: number; hanzi: string; pinyin: string; meaning: string }` import record, incompatible with WordEntry. |

The Pinyin utility also uses an inline `{ vowel: string; tone: number }` map value to decode accented vowels. PinyinInput locally intersects React's keyboard event with `{ defaultMuiPrevented: boolean }` to suppress Material UI's default key handling. The backend imports AWS event/result types and defines private Command (the supported DynamoDB command union) and Result (the injected send result shape). Shared validation lives in src/validation/word.ts.

## Persistence and authentication types

- WordPage (`src/repositories/WordRepository.ts`): items: WordEntry[], nextCursor?: string. list(cursor?) returns Promise<WordPage>; delete(id, updatedAt) requires a revision.
- ApiWordRepository (`src/repositories/ApiWordRepository.ts`): implements WordRepository using a base URL, async access-token provider, and injectable fetch transport. ApiError extends Error with status: number.
- AuthConfig (`src/auth/session.ts`): authorizationEndpoint, tokenEndpoint, clientId, redirectUri, scopes, all strings. AuthSession provides signIn, completeSignIn, hasSession, getAccessToken, and signOut.
- Tokens (private in session.ts): accessToken: string, refreshToken?: string, expiresAt: number (epoch milliseconds).

See [storage](storage.md) and [persistence](../architecture/persistence.md) for lifecycle and request contracts.

UserPopupProps (src/components/UserPopup.tsx): loggedIn: boolean, disabled?: boolean, onSignIn: () => void, onSignOut: () => void. See the component reference for menu behavior.
