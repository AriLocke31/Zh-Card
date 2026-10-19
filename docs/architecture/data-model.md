# Data model

The complete field reference is in [codebase/types](../codebase/types.md). Runtime validation is implemented in src/validation/word.ts and used by the Lambda on writes and ApiWordRepository on successful word responses.

## Aggregate and invariants

WordEntry contains written forms, readings, senses, components, word tags, and creation/update timestamps. Nested IDs must be nonempty and unique within their collections. Writes require nonempty forms and senses. Reads use isStoredWordEntry, which also accepts existing records with an empty senses array so they can be opened and completed; other validation remains in place. Exactly one form must be preferred. Every form has nonblank text and a supported script.

Readings must have a supported variety/system pairing (cmn/pinyin or yue/jyutping), nonblank romanization, boolean standard status, string tags, and unique sense references. Pinyin must parse with explicit tones; Jyutping currently receives only nonblank validation. Senses require definition, language, parseable creation/update dates, supported optional part of speech, valid structured tags, and unique reading references. Both directions of every sense/reading link must agree and refer to existing records. Empty reading collections are allowed.

Components require an ID, nonblank text, supported type, optional string metadata, and an optional nonnegative integer position. Their entryId is not checked against another database entry. Timestamps must parse as dates; UUID syntax is not enforced for nested/client IDs.

## Normalization and ownership

The editor edits Sense.readingIds and rebuilds Reading.senseIds on save. The server validates both directions and copies only domain fields before persisting. It trims form/definition/language/tag values, stores Pinyin as numbered syllables separated by spaces, and generates a tone-marked display. Unknown properties are not persisted.

POST receives a complete draft WordEntry, including temporary client ID/timestamps. The server replaces root ID, createdAt, and updatedAt. PUT requires the existing root updatedAt as a revision, preserves the stored createdAt, and creates a strictly newer updatedAt. The editor retains the loaded root revision until the response succeeds; sense timestamps are refreshed by the editor.

Flashcard, ReviewState, and ExampleSentence are defined types with no persistence or UI workflow yet. There is no schema version or migration mechanism. Legacy flat Word records in db.json are not automatically imported.
