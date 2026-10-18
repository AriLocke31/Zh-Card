import type { WordEntry, UUID } from "../types";

export interface WordRepository {
  getById(id: UUID): Promise<WordEntry | null>;
  list(cursor?: string): Promise<WordPage>;
  create(word: WordEntry): Promise<WordEntry>;
  update(word: WordEntry): Promise<WordEntry>;
  delete(id: UUID, updatedAt: string): Promise<void>;
}

export interface WordPage {
  items: WordEntry[];
  nextCursor?: string;
}
