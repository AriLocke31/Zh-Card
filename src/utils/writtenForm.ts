import type { WordEntry } from "../types";

/** Identity matching preserves script differences and internal whitespace. */
export const normalizeWrittenForm = (text: string): string => text.trim().normalize("NFC");

/** Canceled/outdated checks never replace a newer draft. */
export async function findExistingWord(forms: string[], lookup: (text: string) => Promise<WordEntry | null>, isCurrent = () => true): Promise<WordEntry | null> {
  for (const text of new Set(forms.map(normalizeWrittenForm).filter(Boolean))) {
    if (!isCurrent()) return null;
    const word = await lookup(text);
    if (!isCurrent()) return null;
    if (word) return word;
  }
  return null;
}
