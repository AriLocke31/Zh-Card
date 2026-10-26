# Word Editor

Source: `src/components/WordEditor.tsx`; default export, used by App for creation and editing.

## Props and state

Private `WordEditorProps`:

| Prop | Type | Contract |
| --- | --- | --- |
| `word?` | `WordEntry \| undefined` | Initial entry; omit for creation. |
| `onSave` | `(word: WordEntry) => void or Promise<void>` | Receives the normalized entry after validation succeeds. |
| `onCancel` | `() => void` | Called directly by Cancel. |
| `saving?` | `boolean` | Disables the enclosing fieldset and submission; defaults to false. |
| `saveError?` | `string or null` | Displays parent API failure without resetting the draft. |

Draft state is a deep clone of the initial word. Private `createEmptyWord()` generates a UUID, empty arrays, and ISO creation/update timestamps. Changing props does not reset the mounted draft; App uses keys to remount it. Error state holds the latest save validation failure. App owns asynchronous API calls and supplies saving/error props. The editor retains the loaded root updatedAt revision for conditional updates. There is no dirty-state tracking.

## Editing behavior

- Written forms: add, patch, remove, and choose the preferred form. The first added form is preferred. Removing the preferred form promotes the first remaining form when necessary. Script choices in the UI are simplified and traditional, although the domain type also supports both and variant.
- Conversion suggestions: use convertHanzi for the opposite script when the result differs and no form of that script exists. Accepting adds a new nonpreferred form with a UUID. Conversion is implemented in both directions; see [utilities](utilities.md).
- Readings: add standard Mandarin/Pinyin records, patch, and remove. Switching variety chooses Pinyin or Jyutping and clears romanization/display. Pinyin uses PinyinInput; Jyutping uses a plain TextField, with no dedicated component or syntax validator. Display pronunciation and standard status are separately editable. Reading tags are preserved but have no editing control.
- Senses: add English definitions with IDs/timestamps; edit definition, language, part of speech, notes, and associated readings; remove senses. Deletions clean references in the opposite collection. SenseTagInput adds tags; duplicate category/value pairs are ignored and chips permit removal.
- Word tags: free-form multiple-value Autocomplete. Structural components are preserved in the draft but have no editor UI; the imported WordComponent type is unused.

The local partOfSpeechOptions list mirrors all PartOfSpeech values.

## Save pipeline

1. Trim form text, romanization/display, definition, and language. Refresh every sense's updatedAt.
2. Require at least one form and reject any blank form text.
3. Require at least one sense and reject blank definitions or languages.
4. Reject empty existing readings; an empty readings array is allowed.
5. Require parsePinyin to accept every Pinyin reading.
6. Reject sense readingIds that do not refer to an existing reading.
7. Rebuild Reading.senseIds from Sense.readingIds, normalize Pinyin through parsePinyin, omit empty display values, retain the loaded WordEntry.updatedAt revision, and call onSave. The server assigns the next root timestamp.

Existing IDs and createdAt values are retained. Incoming Reading.senseIds are replaced rather than validated. This pipeline does not enforce all possible domain invariants, such as unique IDs or exactly one preferred form in arbitrary input.

Pinyin normalization stores numbered, whitespace-separated canonical syllables and generates tone-marked display. Server validation additionally checks nested IDs, exactly one preferred form, field types, and bidirectional references. See [persistence](../architecture/persistence.md).

## Presentation

Word Editor and Draft appear in a space-between row above the main form border. The form and nested panels are transparent, square-cornered, and bordered in black. Section dividers extend edge-to-edge across the main panel. Input containers and buttons are transparent and square; button shadows are removed. These styles are scoped to WordEditor rather than changing other application forms.

## Keyboard shortcuts

Shortcuts are scoped to WordEditor's fieldset, using capture handlers so nested autocomplete controls cannot consume them first. Ctrl+Enter invokes the existing validation/save path. Tab in Written forms adds a pronunciation; Tab in Pronunciations adds a definition; Tab in Definitions focuses Word tags. Newly added records receive focus (Hanzi/Pinyin/definition as appropriate) and scroll to the viewport center. Word tags has no blank-record Add operation, so Tab there follows normal navigation. Shift+Tab always retains normal backward navigation.

Shift+A (the uppercase A chord) adds another record within Written forms, Pronunciations, or Definitions and focuses/centers it. This chord is reserved even inside text inputs. IME composition, repeated keydown events, unsupported modifier combinations, and saving state suppress shortcuts. Reduced-motion preferences disable smooth scrolling. Pointer/focus events establish the active section. src/utils/editorShortcuts.ts defines EditorSection and the pure shortcut resolver; WordEditor applies the actions after React commits each added record.


## Existing written-form matches

Optional lookupByForm: (text: string) => Promise<WordEntry or null> and onExistingWord: (word: WordEntry) => void support creation-mode duplicate checks. After 350ms without form changes, the editor checks normalized nonempty forms, suppressing checks during IME composition and ignoring obsolete results. It disables Save during checks or lookup failures and provides Retry. WordPage replaces its word state on a match and remounts WordEditor by the saved ID so every field is loaded from the existing entry. A create-route editor with a matched word saves using update(), preserving the saved revision and avoiding new counters/IDs. Transactional duplicate responses use the same replacement path. No confirmation or draft merge occurs.
