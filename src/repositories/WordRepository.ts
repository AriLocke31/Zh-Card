import type { WordEntry, UUID } from "../types";

export interface WordRepository {
  lookupByForm(form: string): Promise<WordEntry | null>;
  getById(id: UUID): Promise<WordEntry | null>;
  list(cursor?: string): Promise<WordPage>;
  getStudyOrder(): Promise<StudyOrder>;
  syncStudyOrder(order: string[], expectedUpdatedAt?: string): Promise<string>;
  create(word: WordEntry): Promise<WordEntry>;
  update(word: WordEntry): Promise<WordEntry>;
  delete(id: UUID, updatedAt: string): Promise<void>;
}

export interface StudyOrder {
  order: string[];
  updatedAt?: string;
}

export interface WordPage {
  items: WordEntry[];
  nextCursor?: string;
}
