import { Low } from 'lowdb';
import { LocalStorage } from 'lowdb/browser';
import { WordEntry } from './types';

type Database = {
  words: WordEntry[];
};

class AsyncBrowserStorage<T> {
  private storage: LocalStorage<T>;

  constructor(key: string) {
    this.storage = new LocalStorage<T>(key);
  }

  async read(): Promise<T | null> {
    return this.storage.read();
  }

  async write(data: T): Promise<void> {
    this.storage.write(data);
  }
}

const adapter = new AsyncBrowserStorage<Database>('flashcard-db');
const db = new Low<Database>(adapter, { words: [] });

export const initDB = async () => {
  await db.read();
};


export const summarizeMeanings = (meanings: string[]): string => {
  if (meanings.length === 0) return '';
  if (meanings.length <= 2) return meanings.join('. ');

  return `${meanings[0]} (+${meanings.length - 1} more)`;
};

export const getWords = async (): Promise<WordEntry[]> => {
  await db.read();
  return db.data.words;
};

export const addWord = async (word: Omit<WordEntry, 'id'>): Promise<WordEntry> => {
  const newWord = { ...word, id: Date.now().toString() };
  db.data.words.push(newWord);
  await db.write();

  return newWord;
};

export const downloadDB = async () => {
  await db.read();

  const jsonString = JSON.stringify(db.data, null, 2);

  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'flashcard-backup.json';
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const uploadDB = (file: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const importedData = JSON.parse(text);

        if (!importedData.words || !Array.isArray(importedData.words)) {
          throw new Error('Invalid database format');
        }

        await db.read();
        db.data = importedData;
        await db.write();

        resolve();
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};
