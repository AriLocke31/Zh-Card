import type { WordEntry, UUID } from "../types";

export interface WordRepository {
  getById(id: UUID): Promise<WordEntry | null>;
  list(): Promise<WordEntry[]>;
  create(word: WordEntry): Promise<WordEntry>;
  update(word: WordEntry): Promise<WordEntry>;
  delete(id: UUID): Promise<void>;
}
