export type UUID = string;

export interface Flashcard {
  id: UUID;
  wordId: string;

  senseIds: string[];
  readingIds: string[];

  cardType:
  | "recognition"
  | "production"
  | "listening"
  | "writing";

  deckIds: string[]
  createdAt: string;
}

export interface ReviewState {
  cardId: string;

  dueAt: string;

  lastReviewedAt?: string;

  stability?: number;
  difficulty?: number;

  reviewCount: number;
  lapseCount: number;
}

export interface WordEntry {
  id: UUID;

  forms: WrittenForm[];

  readings: Reading[];
  senses: Sense[];

  // Character and word structure
  components: WordComponent[];

  tags: string[];

  createdAt: string;
  updatedAt: string;
}

export interface ExampleSentence {
  id: UUID;

  hanzi: string;

  pinyin?: string;

  translation?: string;

  notes?: string;
}

export interface WrittenForm {
  id: UUID;
  text: string;

  script:
  | "simplified"
  | "traditional"
  | "both"
  | "variant";

  isPreferred: boolean;
}

export interface Reading {
  id: UUID;

  variety: "cmn" | "yue";
  system: "pinyin" | "jyutping";

  // Canonical representation
  romanization: string;
  display?: string;

  senseIds: UUID[];

  isStandard: boolean;
  tags: string[];
}

export interface Sense {
  id: UUID;

  definition: string;
  language: string;

  partOfSpeech?: PartOfSpeech | undefined;

  tags: SenseTag[];

  readingIds: UUID[]

  notes?: string;

  createdAt: string;
  updatedAt: string;
}

export interface SenseTag {
  category:
  | "register"
  | "region"
  | "period"
  | "domain"
  | "usage"
  | "custom";
  value: string;
}

export interface WordComponent {
  id: UUID;
  text: string;
  type:
  | "character"
  | "morpheme"
  | "semantic"
  | "phonetic"
  | "radical"
  | "graphical";

  position?: number;
  entryId?: UUID;
  notes?: string;
}

export type PartOfSpeech =
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "pronoun"
  | "classifier"
  | "particle"
  | "conjunction"
  | "preposition"
  | "interjection"
  | "other";
