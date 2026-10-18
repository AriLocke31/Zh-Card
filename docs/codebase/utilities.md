# Utilities and data

## Pinyin (src/utils/pinyin.ts)

Used by PinyinInput, WordEditor, and shared server/client validation. ToneOption and ParsedPinyin are described in [types](types.md).

| Function | Contract |
| --- | --- |
| normalizePinyinSyllable(input) | Trims, lowercases, normalizes NFC, converts u:/v to umlaut-u, and applies j/q/x/y spelling rules. |
| isValidSyllable(input) | Checks normalized base syllables against MANDARIN_SYLLABLES. |
| applyToneMark(syllable, tone) | Marks a, then e, then o in ou, then the last vowel; tone 5 stays unmarked. |
| getToneOptions(input) | Five options for a valid base syllable, otherwise none. canonical is numbered, display is accented, and label identifies Tone 1-5. |
| isValidNumberedPinyin(input) | Validates one or more whitespace-separated numbered syllables with explicit 1-5 tones. |
| parseSyllable(input) | Parses one numbered or accented syllable, returning ToneOption or null. Bare syllables fail; neutral tone requires 5. |
| parsePinyin(input) | Parses a nonempty whitespace-separated phrase. Returns numbered canonical, accented display, and editingText with explicit neutral-tone numbers, or null. |

Numbered canonical output round-trips, including multi-syllable phrases and neutral tones. The parser validates syllable membership and explicit tones; it is not a word segmenter and does not infer tones for bare input. The editor stores canonical values and computes display on save.

## Hanzi conversion (src/utils/hanziConversion.ts)

HanziScript is simplified or traditional. convertHanzi(text, sourceScript) trims text, returns empty for blank input, and uses OpenCC cn -> tw for simplified sources or tw -> cn for traditional sources. WordEditor offers changed results only if a target-script form does not already exist. Conversion acceptance remains a user decision.

## Data and theme

- src/data/pinyinSyllables.ts exports the active MANDARIN_SYLLABLES set.
- src/data/mockWords.ts exports mockWord, the test fixture with computer forms/readings/sense/components. App no longer imports it.
- src/theme.ts exports the light Material UI palette, rounded shape, and font fallbacks applied in main.tsx.
- src/data.ts is disconnected legacy LowDB storage; see [storage](storage.md).

Shared runtime checks and field-whitelisted normalization are implemented in src/validation/word.ts; [data model](../architecture/data-model.md) lists their invariants.
