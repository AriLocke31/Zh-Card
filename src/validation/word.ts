import type { WordEntry } from "../types";
import { parsePinyin } from "../utils/pinyin";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const optionalText = (value: unknown) => value === undefined || typeof value === "string";
const date = (value: unknown) => text(value) && Number.isFinite(Date.parse(value));
const oneOf = (value: unknown, values: string[]) => typeof value === "string" && values.includes(value);
const records = (value: unknown): value is Record<string, unknown>[] =>
  Array.isArray(value) && value.every(item => isRecord(item) && text(item.id)) &&
  new Set(value.map(item => item.id)).size === value.length;
const ids = (value: unknown): value is string[] => strings(value) && new Set(value).size === value.length;

/** Validate a complete write, including the editor's required definition. */
export function isWordEntry(value: unknown): value is WordEntry {
  return validateWord(value, true);
}

/** Existing records may predate the requirement to supply a definition. */
export function isStoredWordEntry(value: unknown): value is WordEntry {
  return validateWord(value, false);
}

function validateWord(value: unknown, requireSense: boolean): value is WordEntry {
  if (!isRecord(value) || !text(value.id) || !date(value.createdAt) || !date(value.updatedAt) ||
      !strings(value.tags) || !records(value.forms) || !records(value.readings) || !records(value.senses) || !records(value.components)) return false;
  const { forms, readings, senses, components } = value;
  if (!forms.length || (requireSense && !senses.length) || forms.filter(form => form.isPreferred === true).length !== 1) return false;
  if (!forms.every(form => text(form.text) && typeof form.isPreferred === "boolean" &&
      oneOf(form.script, ["simplified", "traditional", "both", "variant"]))) return false;
  if (!readings.every(reading => text(reading.romanization) && optionalText(reading.display) &&
      typeof reading.isStandard === "boolean" && strings(reading.tags) && ids(reading.senseIds) &&
      ((reading.variety === "cmn" && reading.system === "pinyin" && parsePinyin(reading.romanization) !== null) ||
       (reading.variety === "yue" && reading.system === "jyutping")))) return false;
  if (!senses.every(sense => text(sense.definition) && text(sense.language) && date(sense.createdAt) && date(sense.updatedAt) &&
      optionalText(sense.notes) && ids(sense.readingIds) &&
      (sense.partOfSpeech === undefined || oneOf(sense.partOfSpeech, ["noun", "verb", "adjective", "adverb", "pronoun", "classifier", "particle", "conjunction", "preposition", "interjection", "other"])) &&
      Array.isArray(sense.tags) && sense.tags.every(tag => isRecord(tag) && text(tag.value) &&
        oneOf(tag.category, ["register", "region", "period", "domain", "usage", "custom"])))) return false;
  if (!components.every(component => text(component.text) &&
      oneOf(component.type, ["character", "morpheme", "semantic", "phonetic", "radical", "graphical"]) &&
      optionalText(component.entryId) && optionalText(component.notes) &&
      (component.position === undefined || (Number.isInteger(component.position) && Number(component.position) >= 0)))) return false;
  const readingIds = new Set(readings.map(reading => reading.id));
  const senseIds = new Set(senses.map(sense => sense.id));
  return senses.every(sense => (sense.readingIds as string[]).every(id => readingIds.has(id))) &&
    readings.every(reading => (reading.senseIds as string[]).every(id => senseIds.has(id))) &&
    readings.every(reading => senses.every(sense =>
      (reading.senseIds as string[]).includes(String(sense.id)) === (sense.readingIds as string[]).includes(String(reading.id))));
}

/** Copy only model fields before storing untrusted payloads. */
export function normalizeWord(word: WordEntry): WordEntry {
  return {
    id: word.id, createdAt: word.createdAt, updatedAt: word.updatedAt,
    forms: word.forms.map(form => ({ id: form.id, text: form.text.trim(), script: form.script, isPreferred: form.isPreferred })),
    readings: word.readings.map(reading => {
      const parsed = reading.system === "pinyin" ? parsePinyin(reading.romanization) : null;
      const display = parsed?.display ?? reading.display?.trim();
      return { id: reading.id, variety: reading.variety, system: reading.system,
        romanization: parsed?.canonical ?? reading.romanization.trim(), ...(display ? { display } : {}),
        senseIds: [...reading.senseIds], isStandard: reading.isStandard, tags: [...reading.tags] };
    }),
    senses: word.senses.map(sense => ({ id: sense.id, definition: sense.definition.trim(), language: sense.language.trim(),
      ...(sense.partOfSpeech ? { partOfSpeech: sense.partOfSpeech } : {}),
      tags: sense.tags.map(tag => ({ category: tag.category, value: tag.value.trim() })), readingIds: [...sense.readingIds],
      ...(sense.notes !== undefined ? { notes: sense.notes } : {}), createdAt: sense.createdAt, updatedAt: sense.updatedAt })),
    components: word.components.map(component => ({ id: component.id, text: component.text.trim(), type: component.type,
      ...(component.position !== undefined ? { position: component.position } : {}),
      ...(component.entryId !== undefined ? { entryId: component.entryId } : {}),
      ...(component.notes !== undefined ? { notes: component.notes } : {}) })), tags: [...word.tags],
  };
}
