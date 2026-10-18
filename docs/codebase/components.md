# Components

All components are default exports. Paths are relative to the repository root. [Word Editor](word-editor.md) documents the largest component separately.

## App (`src/App.tsx`)

Props: none. Owns the loaded word collection, selected WordEntry or null, pagination cursor, EditorMode (`view | edit | create`), request/saving states, notifications, and deletion confirmation.

Loads the first API page on startup, and fetches selected entries by ID. A request counter prevents obsolete load/selection responses from replacing newer state. Load more merges words by ID. New/Edit mount WordEditor with a fresh key; successful saves replace the selected/listed entry with the server response, while failures leave the draft mounted. Delete requires confirmation and sends the selected revision. Reload list returns to the first page. There are no login/logout controls; no fixture fallback or flashcard callback is wired.

Connection settings come from src/config.ts. App shows an actionable configuration message if required environment values are absent. See [persistence](../architecture/persistence.md) for login, conflicts, and deployment limitations.

## WordDetail (`src/components/WordDetail.tsx`)

Private `WordDetailsProps`:

| Prop | Type | Behavior |
| --- | --- | --- |
| `word` | `WordEntry` | Required entry to display. |
| `onCreateFlashcard?` | `(word: WordEntry) => void` | When supplied, shows a Create Flashcard button and passes the complete word on click. App does not supply it. |

Chooses the first preferred form, falling back to the first form or `-`. Chooses the first standard Mandarin reading, falling back to the first reading; displays `display ?? romanization` or `No pronunciation`. An empty display string does not trigger that nullish fallback. Renders alternative forms, word tags, definitions, part of speech, sense tags and notes, and structural components. It displays arrays in their supplied order and does not resolve component entry links or filter senses by reading. Bookmark is disabled.

## PinyinInput (`src/components/PinyinInput.tsx`)

Private `PinyinInputProps`:

| Prop | Type | Behavior |
| --- | --- | --- |
| `romanization` | `string` | Initial input, converted through parsePinyin when possible. |
| `display?` | `string \| undefined` | Accepted but currently unused by the implementation. |
| `onChange` | `(romanization: string, display: string) => void` | Called after text changes with parsed values, or raw text and an empty display if parsing fails. |
| `sx?` | `SxProps<Theme>` | Forwarded to the outer Material UI Autocomplete. |

Maintains local input, dropdown visibility, and blur state. It initializes from props once and does not synchronize subsequent romanization prop changes; remount to reset it. `getActiveSyllable` returns the last whitespace-delimited token, or an empty string after trailing whitespace. Valid base syllables offer five tone choices. Selecting one replaces the active token and appends a space. Number keys 1-5 select tones unless composing with an IME or using Ctrl/Alt/Meta. Escape/blur close suggestions. Nonempty invalid input shows an error after blur; parent validation still controls saving.

Pinyin canonical values use numbered syllables; tone-marked display and explicit neutral-tone editing are described in [utilities](utilities.md).

## SenseTagInput (`src/components/SenseTagInput.tsx`)

Private `SenseTagInputProps` has one required prop: `onAdd: (tag: SenseTag) => void`.

Owns a category (initially register) and text value. Offers all six SenseTag categories. Add or Enter trims the value, ignores blanks, calls onAdd, and clears the text while retaining the category. The button is disabled for whitespace-only input. Duplicate detection belongs to WordEditor; this component does not perform it.
