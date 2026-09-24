import { MANDARIN_SYLLABLES } from "../data/pinyinSyllables";

export interface ToneOption {
  canonical: string;
  display: string;
  tone: number;
  label: string;
}

export interface ParsedPinyin {
  canonical: string;
  display: string;
  editingText: string;
}

const toneMarks: Record<string, string[]> = {
  a: ["ā", "á", "ǎ", "à"],
  e: ["ē", "é", "ě", "è"],
  i: ["ī", "í", "ǐ", "ì"],
  o: ["ō", "ó", "ǒ", "ò"],
  u: ["ū", "ú", "ǔ", "ù"],
  ü: ["ǖ", "ǘ", "ǚ", "ǜ"],
};

const markedVowels = new Map<string, { vowel: string, tone: number }>();

for (const [vowel, marks] of Object.entries(toneMarks)) {
  marks.forEach((mark, idx) => {
    markedVowels.set(mark, { vowel, tone: idx + 1, });
  });
}

export function normalizePinyinSyllable(input: string): string {
  const syllable = input
    .trim()
    .toLowerCase()
    .normalize("NFC")
    .replace(/u:/g, "ü")
    .replace(/v/g, "ü");

  // After j, q, x, and y, standard pinyin writes ü without the dots.
  return syllable.replace(/^(j|q|x|y)ü/, "$1u");
}

export function isValidSyllable(input: string): boolean {
  return MANDARIN_SYLLABLES.has(normalizePinyinSyllable(input));
}

export function applyToneMark(syllable: string, tone: number): string {
  if (tone === 5)
    return syllable;

  const lower = syllable.toLowerCase();

  // Standard pinying tone-mark placement: a -> e -> ou marks o -> last vowel
  let idx = lower.indexOf("a");

  if (idx === -1)
    idx = lower.indexOf("e");

  if (idx === -1 && lower.includes("ou"))
    idx = lower.indexOf("o");

  if (idx === -1) {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ("aeiouü".includes(lower[i] ?? "")) {
        idx = i;
        break;
      }
    }
  }

  if (idx === -1)
    return syllable;

  const vowel = lower[idx]!;
  const marked = toneMarks[vowel]?.[tone - 1];

  if (!marked)
    return syllable;

  return (syllable.slice(0, idx) + marked + syllable.slice(idx + 1));
}

export function getToneOptions(input: string): ToneOption[] {
  const syllable = normalizePinyinSyllable(input);

  if (!isValidSyllable(syllable))
    return [];

  const labels = [
    applyToneMark(syllable, 0) ? applyToneMark(syllable, 0) : "",
    applyToneMark(syllable, 1) ? applyToneMark(syllable, 1) : "",
    applyToneMark(syllable, 2) ? applyToneMark(syllable, 2) : "",
    applyToneMark(syllable, 3) ? applyToneMark(syllable, 3) : "",
    syllable
  ]

  return [1, 2, 3, 4, 5].map(tone => ({
    canonical: `${syllable}${tone}`,
    display: applyToneMark(syllable, tone),
    tone,
    label: labels[tone - 1]!,
  }));
}

export function isValidNumberedPinyin(input: string): boolean {
  const match = /^([a-zü]+)([1-5])$/.exec(
    input.toLowerCase().trim()
  );

  if (!match) {
    return false;
  }

  return isValidSyllable(match[1]!);
}

export function parseSyllable(input: string): ToneOption | null {
  const text = input.trim().toLowerCase();

  if (!text)
    return null;

  const numbered = /^([a-zü:]+)([1-5])$/.exec(text);

  if (numbered) {
    const base = numbered[1]!;
    const tone = Number(numbered[2]);

    return getToneOptions(base).find(option => option.tone === tone) ?? null;
  }

  let base = "";
  let tone: number | null = null;

  for (const char of text) {
    const marked = markedVowels.get(char);

    if (marked) {
      if (tone !== null) return null;

      base += marked.vowel;
      tone = marked.tone;
    } else {
      base += char;
    }
  }

  if (tone === null)
    return null;

  return getToneOptions(base).find(option => option.tone === tone) ?? null;
}

export function parsePinyin(input: string): ParsedPinyin | null {
  const tokens = input.trim().split(/\s+/);

  if (tokens.length === 0 || !tokens[0])
    return null;

  const parsed = tokens.map(parseSyllable);

  if (parsed.some(token => token === null))
    return null;

  const syllables = parsed as ToneOption[];

  return {
    canonical: syllables
      .map(syllable => syllable.display)
      .join(" "),
    display: syllables
      .map(syllable => syllable.display)
      .join(" "),
    editingText: syllables
      .map(syllable => syllable.tone === 5 ? syllable.canonical : syllable.display)
      .join(" "),
  };
}

